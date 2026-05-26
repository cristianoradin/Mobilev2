'use client'
/**
 * GraficoTestModal
 * Modal de teste de template de gráfico com dados reais.
 * Permite testar via Banco do Portal (sem agente) ou via Agente (dados do posto).
 * Renderiza o gráfico em um frame de dispositivo mobile.
 */
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  X, Smartphone, Monitor, Database, Wifi,
  RefreshCw, AlertCircle, FlaskConical, Building2,
  ChevronDown, Check, Calendar,
} from 'lucide-react'
import type { ChartMetadata } from '@/lib/types'
import { Button } from './Button'
import { cn } from '@/lib/cn'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

// ── ECharts option builder ─────────────────────────────────────────────────────
const PALETTE = ['#009c3b', '#3b82f6', '#f97316', '#fbbf24', '#8b5cf6', '#ec4899']

function buildOption(meta: ChartMetadata, rows: Record<string, unknown>[]) {
  if (meta.chart_type === 'pie') {
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: '#1a1a1a', textStyle: { color: '#fff' } },
      legend: { orient: 'vertical', right: 10, textStyle: { color: '#a0a0a0', fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: rows.map((r, i) => ({
          name:      String(r[meta.axes.x.field] ?? `Item ${i + 1}`),
          value:     Number(r[meta.axes.y[0]?.field ?? ''] ?? 0),
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
        label: { color: '#a0a0a0', fontSize: 11 },
      }],
    }
  }
  if (meta.chart_type === 'gauge') {
    const val = Number(rows[0]?.[meta.axes.y[0]?.field ?? ''] ?? 0)
    return {
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
        data: [{ value: val, name: meta.axes.y[0]?.label ?? '%' }],
        axisLine: { lineStyle: { width: 18, color: [[0.2, '#ef4444'], [0.5, '#fbbf24'], [1, '#009c3b']] } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: '#a0a0a0', fontSize: 10 },
        title:  { color: '#a0a0a0', fontSize: 12 },
        detail: { color: '#fff', fontSize: 26, fontWeight: 700, formatter: '{value}%' },
      }],
    }
  }
  // line / bar / area / heatmap / waterfall
  const xValues = rows.map(r => String(r[meta.axes.x.field] ?? ''))
  const series  = meta.axes.y.map((y, i) => ({
    name:      y.label,
    type:      meta.chart_type === 'area' ? 'line' : meta.chart_type === 'waterfall' ? 'bar' : meta.chart_type,
    data:      rows.map(r => r[y.field]),
    smooth:    meta.chart_type === 'line' || meta.chart_type === 'area',
    itemStyle: { color: y.color ?? PALETTE[i % PALETTE.length] },
    ...(meta.chart_type === 'area' ? { areaStyle: { opacity: 0.12 } } : {}),
  }))
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a1a', textStyle: { color: '#fff' } },
    legend: meta.display.show_legend
      ? { data: meta.axes.y.map(y => y.label), textStyle: { color: '#a0a0a0' }, bottom: 0 }
      : undefined,
    grid: { left: 12, right: 12, top: 12, bottom: meta.display.show_legend ? 40 : 20, containLabel: true },
    xAxis: { type: 'category', data: xValues, axisLabel: { color: '#a0a0a0', fontSize: 10 }, axisLine: { lineStyle: { color: '#2a2a2a' } }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#a0a0a0', fontSize: 10 }, splitLine: { lineStyle: { color: '#2a2a2a', type: 'dashed' } } },
    series,
  }
}

// ── Formatação de valor ────────────────────────────────────────────────────────
function fmtVal(v: unknown, fmt?: string): string {
  if (v == null) return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  switch (fmt) {
    case 'currency': return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'percent':  return `${n.toFixed(1)}%`
    default:         return n.toLocaleString('pt-BR')
  }
}

// ── Renderização do chart com dados reais ─────────────────────────────────────
function ChartContent({ meta, rows }: { meta: ChartMetadata; rows: Record<string, unknown>[] }) {
  const H = { sm: 200, md: 280, lg: 360 }[meta.display.height] ?? 280

  // ── Report ─────────────────────────────────────────────────────────────────
  if (meta.chart_type === 'report') {
    const cols = meta.report_config?.columns ?? []
    if (cols.length === 0) return (
      <div className="h-full flex items-center justify-center text-white/20 text-xs">Configure as colunas do relatório</div>
    )
    return (
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-[#1a1a1a] z-10">
            <tr className="border-b border-white/8">
              {cols.map(c => (
                <th key={c.field} className="px-3 py-2 text-white/50 font-medium text-left whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-white/20">Sem dados retornados</td></tr>
              : rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/2">
                  {cols.map(c => (
                    <td key={c.field} className={cn('px-3 py-2.5 text-white/70', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '')}>
                      {c.format === 'currency' ? fmtVal(row[c.field], 'currency')
                       : c.format === 'number'  ? fmtVal(row[c.field], 'number')
                       : c.format === 'percent' ? fmtVal(row[c.field], 'percent')
                       : String(row[c.field] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    )
  }

  // ── KPI ────────────────────────────────────────────────────────────────────
  if (meta.chart_type === 'kpi') {
    const metrics = meta.kpi_config?.metrics ?? []
    const row     = rows[0] ?? {}
    if (metrics.length === 0) return (
      <div className="h-full flex items-center justify-center text-white/20 text-xs">Configure as métricas KPI</div>
    )
    return (
      <div className="p-4 grid grid-cols-2 gap-3 overflow-auto">
        {metrics.map((m, i) => {
          const color = m.color ?? '#009c3b'
          return (
            <div key={i} className="bg-[#0d0d0d] border border-white/8 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-[10px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.label}</p>
              <p className="text-white text-xl font-bold tabular-nums" style={{ color: row[m.field] != null ? 'white' : 'rgba(255,255,255,0.2)' }}>
                {fmtVal(row[m.field], m.format)}
              </p>
              {m.delta_field && row[m.delta_field] != null && (
                <p className="text-[10px]" style={{ color: Number(row[m.delta_field]) >= 0 ? '#22c55e' : '#ef4444' }}>
                  {Number(row[m.delta_field]) >= 0 ? '+' : ''}{fmtVal(row[m.delta_field], 'percent')} {m.delta_label ?? ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Tank ───────────────────────────────────────────────────────────────────
  if (meta.chart_type === 'tank') {
    const cfg = meta.tank_config
    if (!cfg) return (
      <div className="h-full flex items-center justify-center text-white/20 text-xs">Configure os campos do tank widget</div>
    )
    return (
      <div className="h-full overflow-auto divide-y divide-white/5">
        {rows.length === 0
          ? <div className="h-full flex items-center justify-center text-white/20 text-xs">Sem dados retornados</div>
          : rows.map((row, i) => {
            const vol  = Number(row[cfg.field_volume]       ?? 0)
            const cap  = Number(row[cfg.field_capacidade]   ?? 1)
            const pct  = cfg.field_percentual ? Number(row[cfg.field_percentual] ?? 0) : Math.round((vol / cap) * 100)
            const prod = String(row[cfg.field_produto] ?? `Tanque ${i + 1}`)
            const color = (cfg.product_colors ?? []).find(pc => pc.produto.toLowerCase() === prod.toLowerCase())?.color
              ?? (pct < cfg.threshold_low ? '#ef4444' : pct < cfg.threshold_mid ? '#eab308' : '#009c3b')
            return (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-xs truncate mb-1">{prod}</p>
                  <p className="font-bold text-lg tabular-nums" style={{ color }}>{vol.toLocaleString('pt-BR')} {cfg.unidade}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  <p className="font-bold text-base tabular-nums" style={{ color }}>{pct.toFixed(1)}%</p>
                  <p className="text-white/25 text-[10px]">cap. {cap.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )
          })
        }
      </div>
    )
  }

  // ── Button (sem dados) ─────────────────────────────────────────────────────
  if (meta.chart_type === 'button') {
    const btns = meta.button_config?.buttons ?? []
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {btns.map((b, i) => (
            <div key={i} className="px-4 py-3 rounded-xl bg-[#009c3b]/15 border border-[#009c3b]/30 text-white/70 text-sm text-center">{b.label}</div>
          ))}
          {btns.length === 0 && <p className="text-white/20 text-xs text-center">Nenhum botão configurado</p>}
        </div>
      </div>
    )
  }

  // ── ECharts (line / bar / area / pie / gauge / heatmap / waterfall) ────────
  const option = buildOption(meta, rows)
  return (
    <div className="p-2">
      <ReactECharts
        option={option}
        style={{ height: H, width: '100%' }}
        theme="dark"
        notMerge
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

// ── Modal principal ────────────────────────────────────────────────────────────
interface ClienteBasic { id: string; nome: string; ativo: boolean }
type Source   = 'portal' | 'agente'
type ViewMode = 'phone'  | 'tablet'

interface Props {
  template: ChartMetadata
  onFechar: () => void
}

export function GraficoTestModal({ template, onFechar }: Props) {
  const [source,    setSource]    = useState<Source>('portal')
  const [viewMode,  setViewMode]  = useState<ViewMode>('phone')
  const [clientes,  setClientes]  = useState<ClienteBasic[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [dropOpen,  setDropOpen]  = useState(false)

  // Date range — padrão: últimos 30 dias
  const hasDates = template.date_filter?.enabled ?? false
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().slice(0, 10))

  // Fetch state
  const [loading, setLoading] = useState(false)
  const [rows,    setRows]    = useState<Record<string, unknown>[] | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [error,   setError]   = useState<string | null>(null)

  // Carrega clientes
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then((d: { clientes?: ClienteBasic[] }) => {
        const list = (d.clientes ?? []).filter(c => c.ativo)
        setClientes(list)
        if (list.length > 0) setClienteId(list[0].id)
      })
      .catch(() => {})
  }, [])

  async function buscarDados() {
    setLoading(true)
    setError(null)
    setRows(null)

    try {
      const body: Record<string, unknown> = { sql: template.query.sql }
      if (hasDates) { body.date_from = dateFrom; body.date_to = dateTo }

      let url = '/api/graficos/preview'
      if (source === 'agente') {
        if (!clienteId) { setError('Selecione um cliente'); setLoading(false); return }
        url = '/api/graficos/agent-preview'
        body.cliente_id = clienteId
      }

      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRows(data.rows ?? [])
      setColumns(data.columns ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const device = viewMode === 'phone' ? { w: 390, h: 780 } : { w: 768, h: 900 }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/85 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div className="flex w-full h-full" onClick={e => e.stopPropagation()}>

        {/* ── Painel esquerdo — controles ─────────────────────────────────── */}
        <div className="w-72 bg-[#0f1117] border-r border-white/8 flex flex-col flex-shrink-0">

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 mb-0.5">
                <FlaskConical size={14} className="text-[#009c3b] flex-shrink-0" />
                <p className="text-white text-sm font-semibold truncate">{template.nome}</p>
              </div>
              <p className="text-white/30 text-xs">Teste com dados reais</p>
            </div>
            <button
              onClick={onFechar}
              className="text-white/30 hover:text-white transition-colors mt-0.5 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Fonte dos dados */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">
                Fonte dos dados
              </p>
              <div className="space-y-1.5">
                {[
                  { val: 'portal' as Source, icon: Database, label: 'Banco do Portal', desc: 'Sem agente — dados da sua instalação' },
                  { val: 'agente' as Source, icon: Wifi,     label: 'Agente (Posto)',   desc: 'Dados reais do banco do posto' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => { setSource(opt.val); setRows(null); setError(null) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all',
                      source === opt.val
                        ? 'bg-[#009c3b]/10 border-[#009c3b]/30'
                        : 'bg-white/3 border-white/8 hover:border-white/15',
                    )}
                  >
                    <opt.icon
                      size={14}
                      className={source === opt.val ? 'text-[#009c3b]' : 'text-white/30'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-medium', source === opt.val ? 'text-white' : 'text-white/50')}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{opt.desc}</p>
                    </div>
                    {source === opt.val && <Check size={12} className="text-[#009c3b] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de cliente (modo agente) */}
            {source === 'agente' && (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">
                  Cliente
                </p>
                <button
                  onClick={() => setDropOpen(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/70 text-xs hover:border-white/20 transition-all"
                >
                  <Building2 size={13} className="text-white/30 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">
                    {clientes.find(c => c.id === clienteId)?.nome ?? 'Selecionar…'}
                  </span>
                  <ChevronDown size={12} className="text-white/30 flex-shrink-0" />
                </button>
                {dropOpen && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {clientes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setClienteId(c.id); setDropOpen(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2',
                          c.id === clienteId ? 'text-[#009c3b]' : 'text-white/60',
                        )}
                      >
                        {c.id === clienteId
                          ? <Check size={11} className="flex-shrink-0" />
                          : <span className="w-[11px]" />
                        }
                        <span className="truncate">{c.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Período (se date_filter habilitado) */}
            {hasDates && (
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
                  <Calendar size={10} />Período
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-white/30 mb-1 block">Início</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#009c3b]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 mb-1 block">Fim</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#009c3b]/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Resultado info */}
            {rows !== null && !loading && !error && (
              <div className="bg-[#009c3b]/8 border border-[#009c3b]/20 rounded-xl px-4 py-3">
                <p className="text-[#009c3b] text-xs font-medium">
                  {rows.length} linha{rows.length !== 1 ? 's' : ''} retornadas
                </p>
                {columns.length > 0 && (
                  <p className="text-white/30 text-[10px] mt-0.5 line-clamp-2">
                    {columns.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs break-all">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/8 flex-shrink-0">
            <Button className="w-full" loading={loading} onClick={buscarDados}>
              <RefreshCw size={13} />
              {rows === null ? 'Buscar Dados' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* ── Painel direito — frame do dispositivo ─────────────────────────── */}
        <div
          className="flex-1 flex flex-col items-center justify-center overflow-auto py-6 gap-4 bg-[#080808]"
          onClick={() => setDropOpen(false)}
        >
          {/* Toggle phone / tablet */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 flex-shrink-0">
            {([
              ['phone',  Smartphone, 'Celular (390px)' ],
              ['tablet', Monitor,    'Tablet (768px)'  ],
            ] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all',
                  viewMode === mode ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60',
                )}
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>

          {/* Frame do dispositivo */}
          <div
            className="relative rounded-[32px] border-[6px] border-white/15 shadow-2xl shadow-black/80 bg-[#0d0d0d] overflow-hidden flex-shrink-0"
            style={{ width: device.w + 12, height: device.h + 12 }}
          >
            {/* Dynamic island (celular) */}
            {viewMode === 'phone' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-20" />
            )}

            {/* Área do app */}
            <div
              className="flex flex-col bg-[#0d0d0d] text-white"
              style={{ width: device.w, height: device.h }}
            >
              {/* Status bar */}
              <div className="h-10 bg-[#111] border-b border-white/5 flex items-center justify-between px-5 flex-shrink-0">
                <span className="text-white/50 text-[11px] font-semibold tracking-wide">SGA Petro</span>
                <div className="flex items-center gap-1.5 text-white/25 text-[9px]">
                  <Wifi size={10} />
                  <span>9:41 AM</span>
                </div>
              </div>

              {/* Cabeçalho do gráfico */}
              <div className="px-5 py-3 border-b border-white/5 flex-shrink-0">
                <p className="text-white/80 text-sm font-semibold leading-snug">{template.nome}</p>
                {template.descricao && (
                  <p className="text-white/30 text-[10px] mt-0.5 line-clamp-1">{template.descricao}</p>
                )}
              </div>

              {/* Conteúdo do gráfico */}
              <div className="flex-1 overflow-hidden">
                {loading && (
                  <div className="h-full flex items-center justify-center gap-2 text-white/30">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Carregando dados…</span>
                  </div>
                )}
                {!loading && rows === null && !error && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20 px-8">
                    <FlaskConical size={36} className="opacity-20" />
                    <p className="text-sm text-center leading-relaxed">
                      Configure a fonte e clique em<br />
                      <span className="text-white/40 font-medium">Buscar Dados</span> para testar
                    </p>
                  </div>
                )}
                {!loading && error && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
                    <AlertCircle size={28} className="text-red-400/50" />
                    <p className="text-red-400/70 text-xs text-center break-all leading-relaxed">{error}</p>
                  </div>
                )}
                {!loading && rows !== null && !error && (
                  <ChartContent meta={template} rows={rows} />
                )}
              </div>
            </div>
          </div>

          <p className="text-white/15 text-[10px] font-mono flex-shrink-0">
            {device.w} × {device.h}px
          </p>
        </div>
      </div>
    </div>
  )
}
