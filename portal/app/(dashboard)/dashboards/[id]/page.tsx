'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { Button } from '@/components/ui/Button'
import { Edit2, RefreshCw, BarChart3, LineChart, PieChart, Gauge,
  TrendingUp, TableProperties, Flame, Layers, MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { DateRange, Dashboard, DashboardWidget } from '@/lib/types'
import type { ChartMetadata } from '@/lib/types'

// ── Mock data (em produção: fetch por id) ─────────────────────────────────────
const ALL_TEMPLATES: Record<string, ChartMetadata> = {
  'tmpl-001': {
    id: 'tmpl-001', nome: 'Vendas por Hora', descricao: 'Volume de vendas agrupado por hora do dia',
    categoria: 'vendas', chart_type: 'area', is_publico: true,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'hora', label: 'Hora' }, y: [] }, display: { height: 'md', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'operador' },
  },
  'tmpl-002': {
    id: 'tmpl-002', nome: 'Nível dos Tanques', descricao: 'Percentual atual de combustível em cada tanque',
    categoria: 'estoque', chart_type: 'gauge', is_publico: true,
    query: { sql: '', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'tanque', label: 'Tanque' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  'tmpl-003': {
    id: 'tmpl-003', nome: 'Mix de Combustível', descricao: 'Participação % de cada combustível',
    categoria: 'vendas', chart_type: 'pie', is_publico: false,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'tipo', label: 'Tipo' }, y: [] }, display: { height: 'sm', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'gerente' },
  },
  'tmpl-004': {
    id: 'tmpl-004', nome: 'Faturamento Mensal', descricao: 'Evolução do faturamento nos últimos 30 dias',
    categoria: 'financeiro', chart_type: 'bar', is_publico: false,
    query: { sql: '', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'data', label: 'Data' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'dono' },
  },
  'tmpl-005': {
    id: 'tmpl-005', nome: 'Relatório de Vendas por Produto', descricao: 'Tabela detalhada de vendas',
    categoria: 'vendas', chart_type: 'report', is_publico: true,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'produto', label: 'Produto' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  'tmpl-006': {
    id: 'tmpl-006', nome: 'KPI — Indicadores do Dia', descricao: '4 métricas-chave em tempo real',
    categoria: 'vendas', chart_type: 'kpi', is_publico: true,
    query: { sql: '', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'label', label: 'Métrica' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  'tmpl-007': {
    id: 'tmpl-007', nome: 'Heatmap — Movimento por Hora/Dia', descricao: 'Intensidade de vendas',
    categoria: 'operacional', chart_type: 'heatmap', is_publico: false,
    query: { sql: '', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'hora', label: 'Horário' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'gerente' },
  },
  'tmpl-008': {
    id: 'tmpl-008', nome: 'Waterfall — Demonstrativo de Resultado', descricao: 'Composição do resultado',
    categoria: 'financeiro', chart_type: 'waterfall', is_publico: false,
    query: { sql: '', refresh_seconds: 86400, timeout_seconds: 60 },
    axes: { x: { field: 'componente', label: 'Componente' }, y: [] }, display: { height: 'lg', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'dono' },
  },
  'tmpl-009': {
    id: 'tmpl-009', nome: 'Botões — Ações Rápidas', descricao: 'Atalhos de tela',
    categoria: 'operacional', chart_type: 'button', is_publico: true,
    query: { sql: '', refresh_seconds: 0, timeout_seconds: 0 },
    axes: { x: { field: '', label: '' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
}

const MOCK_DASHBOARDS: Record<string, Dashboard> = {
  'dash-001': {
    id: 'dash-001', nome: 'Operacional do Dia', cor: '#009c3b',
    descricao: 'KPIs, abastecimentos e nível dos tanques em tempo real',
    widgets: [
      { id: 'w1', template_id: 'tmpl-006', size: '3', order: 0 },
      { id: 'w2', template_id: 'tmpl-001', size: '2', order: 1 },
      { id: 'w3', template_id: 'tmpl-002', size: '1', order: 2 },
      { id: 'w4', template_id: 'tmpl-009', size: '1', order: 3 },
    ],
    created_at: '2026-05-20T10:00:00Z',
  },
  'dash-002': {
    id: 'dash-002', nome: 'Financeiro Mensal', cor: '#3b82f6',
    descricao: 'Faturamento, margens e demonstrativo de resultado',
    widgets: [
      { id: 'w5', template_id: 'tmpl-004', size: '2', order: 0 },
      { id: 'w6', template_id: 'tmpl-008', size: '1', order: 1 },
      { id: 'w7', template_id: 'tmpl-005', size: '3', order: 2 },
    ],
    created_at: '2026-05-21T14:00:00Z',
  },
  'dash-003': {
    id: 'dash-003', nome: 'Análise de Vendas', cor: '#f97316',
    descricao: 'Mix de combustíveis, heatmap de movimento e relatório detalhado',
    widgets: [
      { id: 'w8',  template_id: 'tmpl-003', size: '1', order: 0 },
      { id: 'w9',  template_id: 'tmpl-007', size: '2', order: 1 },
      { id: 'w10', template_id: 'tmpl-005', size: '3', order: 2 },
    ],
    created_at: '2026-05-22T08:00:00Z',
  },
}

// ── Ícones por tipo ───────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  line: LineChart, bar: BarChart3, pie: PieChart, gauge: Gauge,
  area: TrendingUp, report: TableProperties, kpi: Flame,
  heatmap: Layers, waterfall: BarChart3, button: MousePointerClick,
}
const TYPE_LABEL: Record<string, string> = {
  report: 'Relatório', kpi: 'KPI Card', heatmap: 'Heatmap',
  waterfall: 'Waterfall', button: 'Botões', line: 'Linha',
  bar: 'Barras', pie: 'Pizza', gauge: 'Gauge', area: 'Área',
}
const HEIGHT_CLS: Record<string, string> = {
  sm: 'h-36', md: 'h-52', lg: 'h-72',
}

// ── Período padrão ────────────────────────────────────────────────────────────
function defaultRange(): DateRange {
  const to   = new Date(); to.setHours(0,0,0,0)
  const from = new Date(to); from.setDate(from.getDate() - 29)
  return { from, to }
}
function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// ── Widget card ───────────────────────────────────────────────────────────────
function WidgetCard({ widget, period }: { widget: DashboardWidget; period: DateRange }) {
  const tmpl   = ALL_TEMPLATES[widget.template_id]
  const Icon   = tmpl ? (ICON_MAP[tmpl.chart_type] ?? BarChart3) : BarChart3
  const hClass = tmpl ? HEIGHT_CLS[tmpl.display.height] : 'h-36'

  if (!tmpl) return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-center justify-center">
      <p className="text-white/20 text-xs">Template não encontrado</p>
    </div>
  )

  return (
    <div className="bg-[#111] border border-white/8 rounded-xl overflow-hidden flex flex-col">
      {/* Header do card */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/6 flex-shrink-0">
        <Icon size={14} className="text-white/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-sm font-medium truncate">{tmpl.nome}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Badge de período (só para tipos que usam datas) */}
          {tmpl.chart_type !== 'button' && period.from && period.to && (
            <span className="text-[9px] text-white/25 font-mono">
              {fmtDate(period.from)} → {fmtDate(period.to)}
            </span>
          )}
          <span className="text-[10px] text-white/30">
            {TYPE_LABEL[tmpl.chart_type] ?? tmpl.chart_type}
          </span>
        </div>
      </div>

      {/* Corpo do widget — placeholder visual por tipo */}
      <div className={cn('flex-1', hClass, 'relative')}>
        <WidgetBody tmpl={tmpl} />
      </div>
    </div>
  )
}

// ── Placeholder visual por tipo de gráfico ────────────────────────────────────
function WidgetBody({ tmpl }: { tmpl: ChartMetadata }) {
  switch (tmpl.chart_type) {
    case 'kpi':
      return (
        <div className="h-full grid grid-cols-4 gap-3 p-4">
          {['Litros', 'Faturamento', 'Margem', 'Abast.'].map((label, i) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-white/40 text-[10px]">{label}</p>
              <p className="text-white text-xl font-bold">—</p>
              <p className="text-white/25 text-[10px]">aguardando dados</p>
            </div>
          ))}
        </div>
      )
    case 'report':
      return (
        <div className="h-full p-3 overflow-hidden">
          <div className="h-8 bg-white/6 rounded-lg mb-2 flex items-center px-3 gap-3">
            {['Produto','Volume','Total','Margem'].map(c => (
              <span key={c} className="text-white/30 text-[10px] flex-1">{c}</span>
            ))}
          </div>
          {Array.from({length: 4}).map((_, i) => (
            <div key={i} className="h-9 border-b border-white/5 flex items-center px-3 gap-3">
              {Array.from({length: 4}).map((_, j) => (
                <div key={j} className="flex-1 h-2 bg-white/8 rounded-full" />
              ))}
            </div>
          ))}
        </div>
      )
    case 'button':
      return (
        <div className="h-full flex items-center justify-center gap-3 p-4">
          {['Estoque', 'Preço', 'Autorizações'].map((label, i) => (
            <div
              key={label}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-medium',
                i === 0 ? 'bg-[#009c3b]/20 text-[#009c3b] border border-[#009c3b]/30'
                : i === 2 ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-white/8 text-white/60 border border-white/10',
              )}
            >
              {label}
            </div>
          ))}
        </div>
      )
    default: {
      // Placeholder de gráfico genérico
      const bars = [40, 65, 30, 80, 55, 70, 45, 90, 60, 75, 50, 85]
      return (
        <div className="h-full flex items-end gap-1 px-4 pb-4 pt-6">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm opacity-40"
              style={{
                height: `${h}%`,
                backgroundColor: '#009c3b',
              }}
            />
          ))}
        </div>
      )
    }
  }
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function DashboardViewPage() {
  const { id } = useParams<{ id: string }>()
  const dash   = MOCK_DASHBOARDS[id]
  const [period, setPeriod] = useState<DateRange>(defaultRange)

  if (!dash) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/30">Dashboard não encontrado</p>
      </div>
    )
  }

  const sortedWidgets = [...dash.widgets].sort((a, b) => a.order - b.order)

  return (
    <div>
      <TopBar
        title={dash.nome}
        subtitle={dash.descricao}
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={period}
              onChange={setPeriod}
              placeholder="Selecionar período"
            />
            <Button variant="secondary" size="sm" title="Atualizar todos os widgets">
              <RefreshCw size={13} />
            </Button>
            <Link href={`/dashboards/${id}/editar`}>
              <Button variant="secondary" size="sm">
                <Edit2 size={13} />Editar
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-3 gap-4">
          {sortedWidgets.map(w => {
            const colSpan = w.size === '3' ? 'col-span-3'
              : w.size === '2' ? 'col-span-2'
              : 'col-span-1'
            return (
              <div key={w.id} className={colSpan}>
                <WidgetCard widget={w} period={period} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
