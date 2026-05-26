/**
 * MultiBlockChart — 1 dataset SQL renderiza N blocos (KPI/Donut/Table/Bar).
 * Lê metadata.multiblock_config.blocks + aplica aggregations client-side.
 */
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type {
  ChartMetadata, MbKpiBlock, MbDonutBlock, MbTableBlock, MbBarBlock,
  AggregateFn, KpiFormat,
} from '@/lib/contracts'
import { ReportTable } from './ReportTable'
import { useTheme } from '@/core/theme/ThemeContext'
import { cn } from '@/lib/cn'

interface Props {
  metadata: ChartMetadata
  data:     Record<string, unknown>[]
  loading?: boolean
}

// ── helpers ──────────────────────────────────────────────────────────────────
function num(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function aggregate(rows: Record<string, unknown>[], field: string, fn: AggregateFn): number {
  if (!rows.length) return 0
  const vals = rows.map(r => num(r[field]))
  switch (fn) {
    case 'sum':   return vals.reduce((a, b) => a + b, 0)
    case 'avg':   return vals.reduce((a, b) => a + b, 0) / vals.length
    case 'min':   return Math.min(...vals)
    case 'max':   return Math.max(...vals)
    case 'count': return rows.length
    case 'first': return num(rows[0][field])
    case 'last':  return num(rows[rows.length - 1][field])
  }
}

function groupSum(rows: Record<string, unknown>[], groupBy: string, valueField: string, agg: AggregateFn = 'sum', topN?: number) {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = String(r[groupBy] ?? 'N/A')
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  let entries = Array.from(map.entries()).map(([name, rs]) => ({ name, value: aggregate(rs, valueField, agg) }))
  entries.sort((a, b) => b.value - a.value)
  if (topN && entries.length > topN) {
    const top   = entries.slice(0, topN)
    const outros = entries.slice(topN).reduce((s, e) => s + e.value, 0)
    entries = [...top, { name: 'Outros', value: outros }]
  }
  return entries
}

function fmtKpi(v: number, format: KpiFormat): string {
  switch (format) {
    case 'currency': return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
    case 'litros':   return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`
    case 'number':   return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    default:         return String(v)
  }
}

// ── Block renderers ─────────────────────────────────────────────────────────
function KpiBlock({ block, rows }: { block: MbKpiBlock; rows: Record<string, unknown>[] }) {
  const value = aggregate(rows, block.field, block.agg)
  const color = block.color ?? 'var(--c-primary)'
  return (
    <div className="bg-surface rounded-2xl border border-rim/40 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="text-ink/50 text-xs">{block.title}</div>
      <div className="text-2xl font-bold mt-1 font-mono tabular-nums" style={{ color }}>
        {fmtKpi(value, block.format)}
      </div>
    </div>
  )
}

function DonutBlock({ block, rows }: { block: MbDonutBlock; rows: Record<string, unknown>[] }) {
  const { isDark } = useTheme()
  const data = useMemo(() => groupSum(rows, block.groupBy, block.valueField, block.valueAgg ?? 'sum', block.topN), [rows, block])
  const total = data.reduce((s, d) => s + d.value, 0)

  const palette = ['#009c3b','#3b82f6','#f97316','#a855f7','#fbbf24','#ec4899','#06b6d4','#84cc16','#ef4444','#6366f1']
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: block.showLegend !== false ? {
      orient: 'horizontal', bottom: 0,
      textStyle: { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 10 },
      itemWidth: 10, itemHeight: 10,
    } : undefined,
    series: [{
      type: 'pie', radius: ['52%', '78%'], avoidLabelOverlap: false,
      label: {
        show: true, position: 'center',
        formatter: () => `${total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}\nTotal`,
        fontSize: 13, fontWeight: 700,
        color: isDark ? '#fff' : '#000', lineHeight: 18,
      },
      labelLine: { show: false },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: palette[i % palette.length] } })),
    }],
  }

  return (
    <div className="bg-surface rounded-2xl border border-rim/40 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="text-ink/70 text-sm font-semibold mb-2">{block.title}</div>
      <ReactECharts option={option} style={{ height: 260, width: '100%' }} />
    </div>
  )
}

function TableBlock({ metadata, block, rows }: { metadata: ChartMetadata; block: MbTableBlock; rows: Record<string, unknown>[] }) {
  // Reusa ReportTable passando config virtual
  const virtual: ChartMetadata = {
    ...metadata,
    report_config: {
      columns: block.columns,
      show_totals: block.showTotals,
    },
  }
  const limited = block.maxRows ? rows.slice(0, block.maxRows) : rows
  return (
    <div>
      {block.title && <div className="text-ink/70 text-sm font-semibold mb-2">{block.title}</div>}
      <ReportTable metadata={virtual} data={limited} />
    </div>
  )
}

function BarBlock({ block, rows }: { block: MbBarBlock; rows: Record<string, unknown>[] }) {
  const { isDark } = useTheme()
  const grouped = useMemo(() => groupSum(rows, block.xField, block.yField, block.yAgg ?? 'sum'), [rows, block])
  const horizontal = block.orientation === 'h'
  const axisStyle = {
    axisLabel: { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontSize: 10 },
    axisLine:  { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
    splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
  }
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 12, bottom: 24, left: horizontal ? 90 : 36, right: 12 },
    tooltip: { trigger: 'axis' },
    xAxis: horizontal ? { type: 'value', ...axisStyle } : { type: 'category', data: grouped.map(g => g.name), ...axisStyle },
    yAxis: horizontal ? { type: 'category', data: grouped.map(g => g.name), ...axisStyle } : { type: 'value', ...axisStyle },
    series: [{
      type: 'bar',
      data: grouped.map(g => g.value),
      itemStyle: { color: 'var(--c-primary)' },
      barMaxWidth: 24,
    }],
  }
  return (
    <div className="bg-surface rounded-2xl border border-rim/40 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="text-ink/70 text-sm font-semibold mb-2">{block.title}</div>
      <ReactECharts option={option} style={{ height: 240 }} />
    </div>
  )
}

// ── Render principal ─────────────────────────────────────────────────────────
export function MultiBlockChart({ metadata, data, loading }: Props) {
  const cfg    = metadata.multiblock_config
  const blocks = cfg?.blocks ?? []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-ink/40">Carregando…</span>
      </div>
    )
  }

  if (!blocks.length) {
    return <div className="text-center py-12 text-sm text-ink/40">Sem blocos configurados</div>
  }

  // Separa KPIs (linha topo) de demais (empilhados)
  const kpis  = blocks.filter(b => b.type === 'kpi')  as MbKpiBlock[]
  const outros = blocks.filter(b => b.type !== 'kpi')

  const preset = cfg?.layout?.preset ?? 'kpis-top'

  return (
    <div className="space-y-3">
      {/* KPIs em grid responsivo */}
      {kpis.length > 0 && preset === 'kpis-top' && (
        <div className={cn(
          'grid gap-2',
          kpis.length === 1 ? 'grid-cols-1' :
          kpis.length === 2 ? 'grid-cols-2' :
          kpis.length === 3 ? 'grid-cols-3' :
          'grid-cols-2 sm:grid-cols-4',
        )}>
          {kpis.map((b, i) => <KpiBlock key={i} block={b} rows={data} />)}
        </div>
      )}

      {/* Demais blocos empilhados */}
      {outros.map((b, i) => {
        const key = `${b.type}-${i}`
        if (b.type === 'donut') return <DonutBlock key={key} block={b} rows={data} />
        if (b.type === 'table') return <TableBlock key={key} metadata={metadata} block={b} rows={data} />
        if (b.type === 'bar')   return <BarBlock   key={key} block={b} rows={data} />
        return null
      })}

      {/* Se preset != kpis-top, KPIs vão no fim */}
      {kpis.length > 0 && preset !== 'kpis-top' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {kpis.map((b, i) => <KpiBlock key={i} block={b} rows={data} />)}
        </div>
      )}
    </div>
  )
}
