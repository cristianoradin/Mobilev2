'use client'
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type {
  ChartMetadata, MultiBlock, MbKpiBlock, MbDonutBlock, MbTableBlock, MbBarBlock,
  AggregateFn, KpiFormat,
} from '@/lib/types'
import { cn } from '@/lib/cn'

interface Props {
  metadata: ChartMetadata
  realData?: { columns: string[]; rows: Record<string, unknown>[] } | null
}

// helpers
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
function groupSum(rows: Record<string, unknown>[], gb: string, vf: string, agg: AggregateFn = 'sum', topN?: number) {
  const m = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = String(r[gb] ?? 'N/A')
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  let entries = Array.from(m.entries()).map(([name, rs]) => ({ name, value: aggregate(rs, vf, agg) }))
  entries.sort((a, b) => b.value - a.value)
  if (topN && entries.length > topN) {
    const outros = entries.slice(topN).reduce((s, e) => s + e.value, 0)
    entries = [...entries.slice(0, topN), { name: 'Outros', value: outros }]
  }
  return entries
}
function fmtKpi(v: number, fmt: KpiFormat): string {
  switch (fmt) {
    case 'currency': return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
    case 'litros':   return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`
    case 'number':   return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    default:         return String(v)
  }
}

// Mock rows quando sem dados reais — usa colunas dos blocos
function mockRows(blocks: MultiBlock[]): Record<string, unknown>[] {
  const fields = new Set<string>()
  for (const b of blocks) {
    if (b.type === 'kpi')   fields.add(b.field)
    if (b.type === 'donut') { fields.add(b.groupBy); fields.add(b.valueField) }
    if (b.type === 'bar')   { fields.add(b.xField); fields.add(b.yField) }
    if (b.type === 'table') b.columns.forEach(c => fields.add(c.field))
  }
  const fieldsArr = Array.from(fields)
  const groupFields = fieldsArr.filter(f => /produto|nome|tipo|cat/i.test(f))
  const groupVals = groupFields.length
    ? ['Gasolina', 'Etanol', 'Diesel S10', 'Diesel Comum', 'GNV']
    : []
  return Array.from({ length: 5 }, (_, i) => {
    const row: Record<string, unknown> = {}
    for (const f of fieldsArr) {
      if (groupFields.includes(f)) row[f] = groupVals[i] ?? `Item ${i + 1}`
      else row[f] = Math.round((Math.random() * 50000 + 1000) * 100) / 100
    }
    return row
  })
}

function KpiPreviewBlock({ block, rows }: { block: MbKpiBlock; rows: Record<string, unknown>[] }) {
  const v = aggregate(rows, block.field, block.agg)
  return (
    <div className="bg-[#161616] rounded-xl border border-white/8 p-3">
      <div className="text-white/40 text-[10px] uppercase tracking-wider">{block.title}</div>
      <div className="text-lg font-bold mt-0.5 font-mono tabular-nums" style={{ color: block.color ?? '#009c3b' }}>
        {fmtKpi(v, block.format)}
      </div>
    </div>
  )
}

function DonutPreviewBlock({ block, rows }: { block: MbDonutBlock; rows: Record<string, unknown>[] }) {
  const data = useMemo(() => groupSum(rows, block.groupBy, block.valueField, block.valueAgg ?? 'sum', block.topN), [rows, block])
  const total = data.reduce((s, d) => s + d.value, 0)
  const palette = ['#009c3b','#3b82f6','#f97316','#a855f7','#fbbf24','#ec4899','#06b6d4','#84cc16']
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: block.showLegend !== false ? { orient: 'horizontal', bottom: 0, textStyle: { color: 'rgba(255,255,255,0.55)', fontSize: 9 } } : undefined,
    series: [{
      type: 'pie', radius: ['52%', '78%'],
      label: { show: true, position: 'center', formatter: () => `${total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}\nTotal`, fontSize: 11, color: '#fff', fontWeight: 700, lineHeight: 14 },
      labelLine: { show: false },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: palette[i % palette.length] } })),
    }],
  }
  return (
    <div className="bg-[#161616] rounded-xl border border-white/8 p-3">
      <div className="text-white/70 text-xs font-semibold mb-1">{block.title}</div>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
  )
}

function TablePreviewBlock({ block, rows }: { block: MbTableBlock; rows: Record<string, unknown>[] }) {
  const limited = block.maxRows ? rows.slice(0, block.maxRows) : rows.slice(0, 5)
  return (
    <div className="bg-[#161616] rounded-xl border border-white/8 p-3">
      {block.title && <div className="text-white/70 text-xs font-semibold mb-2">{block.title}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-white/40 border-b border-white/10">
              {block.columns.map(c => (
                <th key={c.field} className={cn('px-2 py-1.5 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {limited.map((r, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                {block.columns.map(c => (
                  <td key={c.field} className={cn('px-2 py-1 text-white/75', c.align === 'right' && 'text-right tabular-nums font-mono')}>
                    {String(r[c.field] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BarPreviewBlock({ block, rows }: { block: MbBarBlock; rows: Record<string, unknown>[] }) {
  const grouped = useMemo(() => groupSum(rows, block.xField, block.yField, block.yAgg ?? 'sum'), [rows, block])
  const horizontal = block.orientation === 'h'
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 8, bottom: 24, left: horizontal ? 80 : 30, right: 8 },
    tooltip: { trigger: 'axis' },
    xAxis: horizontal ? { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 } } : { type: 'category', data: grouped.map(g => g.name), axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 } },
    yAxis: horizontal ? { type: 'category', data: grouped.map(g => g.name), axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 } } : { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9 } },
    series: [{ type: 'bar', data: grouped.map(g => g.value), itemStyle: { color: '#009c3b' }, barMaxWidth: 20 }],
  }
  return (
    <div className="bg-[#161616] rounded-xl border border-white/8 p-3">
      <div className="text-white/70 text-xs font-semibold mb-1">{block.title}</div>
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
  )
}

export function MultiBlockPreview({ metadata, realData }: Props) {
  const blocks = metadata.multiblock_config?.blocks ?? []
  const useReal = Boolean(realData?.rows?.length)
  const rows = useReal ? realData!.rows : mockRows(blocks)

  if (!blocks.length) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-xs px-6 text-center">
        Adicione blocos pela aba "Blocos" pra ver o preview multiblock
      </div>
    )
  }

  const kpis  = blocks.filter(b => b.type === 'kpi')  as MbKpiBlock[]
  const outros = blocks.filter(b => b.type !== 'kpi')

  return (
    <div className="h-full flex flex-col bg-[#111] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className={cn('text-[10px]', useReal ? 'text-emerald-400/80' : 'text-white/40')}>
          {useReal ? '● Dados reais' : 'Mock'} · {blocks.length} bloco(s)
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {kpis.length > 0 && (
          <div className={cn(
            'grid gap-2',
            kpis.length === 1 ? 'grid-cols-1' :
            kpis.length === 2 ? 'grid-cols-2' :
            kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
          )}>
            {kpis.map((b, i) => <KpiPreviewBlock key={i} block={b} rows={rows} />)}
          </div>
        )}
        {outros.map((b, i) => {
          const key = `${b.type}-${i}`
          if (b.type === 'donut') return <DonutPreviewBlock key={key} block={b} rows={rows} />
          if (b.type === 'table') return <TablePreviewBlock key={key} block={b} rows={rows} />
          if (b.type === 'bar')   return <BarPreviewBlock   key={key} block={b} rows={rows} />
          return null
        })}
      </div>
    </div>
  )
}
