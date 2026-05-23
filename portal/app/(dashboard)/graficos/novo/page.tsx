'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SQLEditor }       from '@/components/sql-builder/SQLEditor'
import { ChartPreview }    from '@/components/charts/ChartPreview'
import { ReportPreview }   from '@/components/reports/ReportPreview'
import { KpiPreview }      from '@/components/charts/KpiPreview'
import { HeatmapPreview }  from '@/components/charts/HeatmapPreview'
import { WaterfallPreview} from '@/components/charts/WaterfallPreview'
import { ButtonPreview }   from '@/components/charts/ButtonPreview'
import { TopBar }  from '@/components/layout/TopBar'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { cn }      from '@/lib/cn'
import { ICON_NAMES, ICON_REGISTRY } from '@/lib/icons'
import {
  Save, Plus, Trash2, RefreshCw, Calendar, CalendarRange,
  TableProperties, BarChart3, Activity, Flame, Layers, MousePointerClick,
} from 'lucide-react'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import type { DateRange } from '@/components/ui/DateRangePicker'
import type {
  ChartMetadata, ChartType, UserRole,
  ReportColumn, ReportColumnFormat, ReportSummaryFn,
  KpiMetric, KpiConfig,
  ButtonWidgetItem, ButtonWidgetConfig, ButtonVariant, ButtonSize,
  TemplateDateFilter, DatePreset,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CHART_TYPES: { value: ChartType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'area',      label: 'Área',      icon: BarChart3,          color: '#009c3b' },
  { value: 'line',      label: 'Linha',     icon: Activity,           color: '#009c3b' },
  { value: 'bar',       label: 'Barra',     icon: BarChart3,          color: '#009c3b' },
  { value: 'pie',       label: 'Pizza',     icon: Layers,             color: '#009c3b' },
  { value: 'gauge',     label: 'Gauge',     icon: Activity,           color: '#009c3b' },
  { value: 'report',    label: 'Relatório', icon: TableProperties,    color: '#3b82f6' },
  { value: 'kpi',       label: 'KPI Card',  icon: Flame,              color: '#f59e0b' },
  { value: 'heatmap',   label: 'Heatmap',   icon: Layers,             color: '#8b5cf6' },
  { value: 'waterfall', label: 'Waterfall', icon: BarChart3,          color: '#06b6d4' },
  { value: 'button',    label: 'Botões',    icon: MousePointerClick,  color: '#f43f5e' },
]

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'operador', label: 'Operador (todos)' },
  { value: 'gerente',  label: 'Gerente e acima'  },
  { value: 'dono',     label: 'Apenas Dono'       },
]

// Report
const FORMATS: { value: ReportColumnFormat; label: string }[] = [
  { value: 'text',     label: 'Texto'     },
  { value: 'number',   label: 'Número'    },
  { value: 'currency', label: 'Moeda'     },
  { value: 'percent',  label: '%'         },
  { value: 'date',     label: 'Data'      },
  { value: 'datetime', label: 'Data/Hora' },
  { value: 'badge',    label: 'Badge'     },
]
const SUMMARIES: { value: ReportSummaryFn; label: string }[] = [
  { value: 'none',  label: '—'       },
  { value: 'sum',   label: 'Soma'    },
  { value: 'avg',   label: 'Média'   },
  { value: 'count', label: 'Contagem'},
  { value: 'min',   label: 'Mínimo'  },
  { value: 'max',   label: 'Máximo'  },
]

// Button
const BTN_VARIANTS: { value: ButtonVariant; label: string }[] = [
  { value: 'primary',   label: 'Primário'   },
  { value: 'secondary', label: 'Secundário' },
  { value: 'danger',    label: 'Perigo'     },
  { value: 'ghost',     label: 'Ghost'      },
]
const BTN_SIZES: { value: ButtonSize; label: string }[] = [
  { value: 'sm', label: 'P' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'G' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ReportColumn[] = [
  { field: 'produto',    label: 'Produto',    format: 'text',     align: 'left',   summary: 'none' },
  { field: 'quantidade', label: 'Qtd (L)',    format: 'number',   align: 'right',  summary: 'sum'  },
  { field: 'total',      label: 'Total (R$)', format: 'currency', align: 'right',  summary: 'sum'  },
  { field: 'data',       label: 'Data',       format: 'date',     align: 'center', summary: 'none' },
]

const DEFAULT_KPI: KpiConfig = {
  layout: '4',
  metrics: [
    { field: 'litros',         label: 'Litros Vendidos',  format: 'number',   delta_field: 'delta_litros',  delta_label: 'vs ontem', icon: 'Fuel',         color: '#009c3b', sparkline: true  },
    { field: 'faturamento',    label: 'Faturamento',      format: 'currency', delta_field: 'delta_fat',     delta_label: 'vs ontem', icon: 'DollarSign',   color: '#3b82f6', sparkline: true  },
    { field: 'margem',         label: 'Margem Média',     format: 'percent',  delta_field: 'delta_margem',  delta_label: 'vs ontem', icon: 'TrendingUp',   color: '#f59e0b', sparkline: false },
    { field: 'abastecimentos', label: 'Abastecimentos',   format: 'number',   delta_field: 'delta_abast',   delta_label: 'vs ontem', icon: 'ShoppingCart', color: '#8b5cf6', sparkline: false },
  ],
}

const DEFAULT_BUTTON: ButtonWidgetConfig = {
  layout: 'horizontal',
  buttons: [
    { icon: 'Fuel',          label: 'Estoque de Tanques', variant: 'primary',   size: 'md', action: { type: 'navigate', route: '/estoque'      } },
    { icon: 'DollarSign',    label: 'Trocar Preço',       variant: 'secondary', size: 'md', action: { type: 'navigate', route: '/troca-preco'  } },
    { icon: 'AlertTriangle', label: 'Autorizações',       variant: 'danger',    size: 'md', action: { type: 'navigate', route: '/autorizacoes' } },
  ],
}

const DEFAULT_DATE_FILTER: TemplateDateFilter = {
  enabled:        false,
  param_inicio:   ':data_inicio',
  param_fim:      ':data_fim',
  default_preset: 'last_30d',
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',      label: 'Hoje'          },
  { value: 'yesterday',  label: 'Ontem'         },
  { value: 'last_7d',    label: 'Últimos 7 dias' },
  { value: 'last_30d',   label: 'Últimos 30 dias'},
  { value: 'this_month', label: 'Este mês'      },
  { value: 'last_month', label: 'Mês anterior'  },
  { value: 'custom',     label: 'Data fixa...'  },
]

const DEFAULT_META: ChartMetadata = {
  id: '', nome: '', descricao: '',
  categoria: 'vendas',
  chart_type: 'area',
  query:   { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
  axes:    { x: { field: 'hora', label: 'Hora' }, y: [{ field: 'total', label: 'Total (R$)', color: '#009c3b' }] },
  display: { height: 'md', show_legend: true, show_tooltip: true, gradient: true },
  permissions:   { min_role: 'operador' },
  is_publico:    false,
  date_filter:   DEFAULT_DATE_FILTER,
  report_config: { columns: DEFAULT_COLUMNS, show_totals: true, show_index: false },
  kpi_config:    DEFAULT_KPI,
  button_config: DEFAULT_BUTTON,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes — IconPicker
// ─────────────────────────────────────────────────────────────────────────────
function IconPickerButton({
  value, onChange,
}: { value?: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const Cur = value ? ICON_REGISTRY[value] : null

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Escolher ícone"
        className="w-9 h-9 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:border-white/20 transition-colors"
      >
        {Cur
          ? <Cur size={15} className="text-white/60" />
          : <span className="text-white/20 text-[9px] leading-none text-center">ico</span>
        }
      </button>

      {open && (
        <>
          {/* overlay para fechar */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-10 left-0 bg-[#1c1c1c] border border-white/10 rounded-xl p-2
                          shadow-2xl grid grid-cols-6 gap-1 w-[196px]">
            {ICON_NAMES.map(name => {
              const I = ICON_REGISTRY[name]
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false) }}
                  title={name}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    value === name
                      ? 'bg-[#009c3b]/25 text-[#009c3b]'
                      : 'text-white/35 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <I size={14} />
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente — linha de coluna do Relatório
// ─────────────────────────────────────────────────────────────────────────────
function ColRow({
  col, index, total, onChange, onRemove,
}: {
  col:      ReportColumn
  index:    number
  total:    number
  onChange: (f: keyof ReportColumn, v: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 group/row">
      <input
        value={col.field}
        onChange={e => onChange('field', e.target.value)}
        placeholder="campo_sql"
        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono w-28
                   focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
      />
      <input
        value={col.label}
        onChange={e => onChange('label', e.target.value)}
        placeholder="Rótulo"
        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs flex-1
                   focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
      />
      <select
        value={col.format ?? 'text'}
        onChange={e => onChange('format', e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-24"
      >
        {FORMATS.map(f => <option key={f.value} value={f.value} className="bg-[#111]">{f.label}</option>)}
      </select>
      {/* Alinhamento */}
      <div className="flex border border-white/10 rounded-lg overflow-hidden">
        {(['left','center','right'] as const).map(a => (
          <button
            key={a} type="button"
            onClick={() => onChange('align', a)}
            className={cn(
              'px-2 py-1.5 text-[10px] font-mono transition-colors',
              col.align === a ? 'bg-[#009c3b]/80 text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/5',
            )}
          >
            {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
          </button>
        ))}
      </div>
      <select
        value={col.summary ?? 'none'}
        onChange={e => onChange('summary', e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-24"
      >
        {SUMMARIES.map(s => <option key={s.value} value={s.value} className="bg-[#111]">{s.label}</option>)}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={total <= 1}
        className="text-red-400/30 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// Swatches de cores pré-definidas para botões
const BTN_COLORS = [
  { color: '',        label: 'Variante' },   // usa variant (sem cor fixa)
  { color: '#009c3b', label: 'Verde'    },
  { color: '#3b82f6', label: 'Azul'     },
  { color: '#f97316', label: 'Laranja'  },
  { color: '#8b5cf6', label: 'Roxo'     },
  { color: '#ec4899', label: 'Rosa'     },
  { color: '#14b8a6', label: 'Ciano'    },
  { color: '#eab308', label: 'Amarelo'  },
  { color: '#ef4444', label: 'Vermelho' },
  { color: '#64748b', label: 'Cinza'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente — linha de botão do Widget
// ─────────────────────────────────────────────────────────────────────────────
function BtnRow({
  btn, index, total, onChange, onRemove,
}: {
  btn:      ButtonWidgetItem
  index:    number
  total:    number
  onChange: (f: keyof ButtonWidgetItem | 'action.type' | 'action.route' | 'action.url' | 'action.template_id', v: string) => void
  onRemove: () => void
}) {
  const activeColor = btn.color ?? ''

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 space-y-2.5">
      {/* Linha 1: ícone + label + tamanho + delete */}
      <div className="flex items-center gap-2">
        <IconPickerButton value={btn.icon} onChange={v => onChange('icon', v)} />
        <input
          value={btn.label}
          onChange={e => onChange('label', e.target.value)}
          placeholder="Rótulo do botão"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs
                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
        />
        {/* Tamanho */}
        <div className="flex border border-white/10 rounded-lg overflow-hidden flex-shrink-0">
          {BTN_SIZES.map(s => (
            <button
              key={s.value} type="button"
              onClick={() => onChange('size', s.value)}
              className={cn(
                'px-2.5 py-1.5 text-[10px] font-medium transition-colors',
                btn.size === s.value ? 'bg-[#009c3b]/80 text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/5',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={total <= 1}
          className="text-red-400/30 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Linha 2: cores */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-white/30 text-[10px] uppercase tracking-wider font-medium w-10 flex-shrink-0">Cor</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {BTN_COLORS.map(({ color, label }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => onChange('color', color)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-all flex-shrink-0',
                activeColor === color
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-white/40 hover:scale-105',
              )}
              style={
                color
                  ? { backgroundColor: color }
                  : {
                      background: 'linear-gradient(135deg, #009c3b 50%, #3b82f6 50%)',
                    }
              }
            />
          ))}
          {/* Input de cor livre */}
          <div className="relative flex-shrink-0" title="Cor personalizada">
            <input
              type="color"
              value={activeColor || '#009c3b'}
              onChange={e => onChange('color', e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] font-bold',
                activeColor && !BTN_COLORS.some(c => c.color === activeColor)
                  ? 'border-white scale-110'
                  : 'border-dashed border-white/30 hover:border-white/60',
              )}
              style={
                activeColor && !BTN_COLORS.some(c => c.color === activeColor)
                  ? { backgroundColor: activeColor }
                  : {}
              }
            >
              {!(activeColor && !BTN_COLORS.some(c => c.color === activeColor)) && (
                <span className="text-white/40">+</span>
              )}
            </div>
          </div>

          {/* Preview do botão em miniatura */}
          {activeColor && (
            <div
              className="ml-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white flex-shrink-0 transition-all"
              style={{ backgroundColor: activeColor, boxShadow: `0 2px 8px ${activeColor}50` }}
            >
              {btn.label || 'Botão'}
            </div>
          )}
        </div>
      </div>

      {/* Linha 3: variant (só quando sem cor customizada) + ação */}
      <div className="flex items-center gap-2">
        {!activeColor && (
          <select
            value={btn.variant ?? 'primary'}
            onChange={e => onChange('variant', e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-28 flex-shrink-0"
          >
            {BTN_VARIANTS.map(v => <option key={v.value} value={v.value} className="bg-[#111]">{v.label}</option>)}
          </select>
        )}
        <span className="text-white/30 text-[10px] uppercase tracking-wider font-medium flex-shrink-0">Ação</span>
        <select
          value={btn.action.type}
          onChange={e => onChange('action.type', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-32 flex-shrink-0"
        >
          <option value="navigate" className="bg-[#111]">Navegar para tela</option>
          <option value="template" className="bg-[#111]">Abrir template</option>
          <option value="url"      className="bg-[#111]">URL externa</option>
        </select>
        <input
          value={
            btn.action.type === 'navigate' ? (btn.action.route ?? '')
            : btn.action.type === 'url'    ? (btn.action.url   ?? '')
            : (btn.action.template_id ?? '')
          }
          onChange={e => {
            const key = btn.action.type === 'navigate' ? 'action.route'
              : btn.action.type === 'url' ? 'action.url'
              : 'action.template_id'
            onChange(key, e.target.value)
          }}
          placeholder={
            btn.action.type === 'navigate' ? '/rota (ex: /estoque)'
            : btn.action.type === 'url'    ? 'https://...'
            : 'ID do template'
          }
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono
                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function NovoGraficoPage() {
  const router = useRouter()
  const [meta,       setMeta]       = useState<ChartMetadata>(DEFAULT_META)
  const [saving,     setSaving]     = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const type = meta.chart_type

  // ── helpers gerais ──────────────────────────────────────────────────────
  function update<K extends keyof ChartMetadata>(key: K, value: ChartMetadata[K]) {
    setMeta(prev => ({ ...prev, [key]: value }))
  }

  function changeType(t: ChartType) {
    setMeta(prev => ({
      ...prev,
      chart_type:    t,
      kpi_config:    prev.kpi_config    ?? DEFAULT_KPI,
      button_config: prev.button_config ?? DEFAULT_BUTTON,
      report_config: prev.report_config ?? { columns: DEFAULT_COLUMNS, show_totals: true, show_index: false },
    }))
    setPreviewKey(k => k + 1)
  }

  // ── helpers: report ─────────────────────────────────────────────────────
  const repCols = meta.report_config?.columns ?? DEFAULT_COLUMNS

  function setRepCols(cols: ReportColumn[]) {
    setMeta(prev => ({ ...prev, report_config: { ...(prev.report_config ?? {}), columns: cols } }))
  }
  function updateRepCol(i: number, f: keyof ReportColumn, v: string) {
    setRepCols(repCols.map((c, ci) => ci === i ? { ...c, [f]: v } : c))
    setPreviewKey(k => k + 1)
  }
  function addRepCol() {
    setRepCols([...repCols, { field: `col${repCols.length + 1}`, label: `Coluna ${repCols.length + 1}`, format: 'text', align: 'left', summary: 'none' }])
  }
  function removeRepCol(i: number) {
    if (repCols.length <= 1) return
    setRepCols(repCols.filter((_, ci) => ci !== i))
    setPreviewKey(k => k + 1)
  }
  function setRepFlag(k: 'show_totals' | 'show_index', v: boolean) {
    setMeta(prev => ({ ...prev, report_config: { ...(prev.report_config ?? { columns: repCols }), [k]: v } }))
    setPreviewKey(k => k + 1)
  }

  // ── helpers: kpi ────────────────────────────────────────────────────────
  const kpiCfg = meta.kpi_config ?? DEFAULT_KPI

  function setKpi(c: KpiConfig) { update('kpi_config', c); setPreviewKey(k => k + 1) }
  function addKpiMetric() {
    if (kpiCfg.metrics.length >= 4) return
    setKpi({ ...kpiCfg, metrics: [...kpiCfg.metrics, { field: `metrica${kpiCfg.metrics.length + 1}`, label: `Métrica ${kpiCfg.metrics.length + 1}`, format: 'number', icon: 'BarChart3', color: '#009c3b' }] })
  }
  function updateKpiMetric(i: number, f: keyof KpiMetric, v: string | boolean) {
    const next = kpiCfg.metrics.map((m, mi) => mi === i ? { ...m, [f]: v } : m)
    setKpi({ ...kpiCfg, metrics: next })
  }
  function removeKpiMetric(i: number) {
    if (kpiCfg.metrics.length <= 1) return
    setKpi({ ...kpiCfg, metrics: kpiCfg.metrics.filter((_, mi) => mi !== i) })
  }

  // ── helpers: button ─────────────────────────────────────────────────────
  const btnCfg = meta.button_config ?? DEFAULT_BUTTON

  function setBtnCfg(c: ButtonWidgetConfig) { update('button_config', c); setPreviewKey(k => k + 1) }
  function addBtn() {
    setBtnCfg({ ...btnCfg, buttons: [...btnCfg.buttons, { icon: 'ArrowRight', label: 'Novo Botão', variant: 'secondary', size: 'md', action: { type: 'navigate', route: '/' } }] })
  }
  function updateBtn(i: number, field: string, v: string) {
    const next = btnCfg.buttons.map((b, bi) => {
      if (bi !== i) return b
      if (field === 'action.type') return { ...b, action: { type: v as ButtonWidgetItem['action']['type'], route: b.action.route } }
      if (field === 'action.route')       return { ...b, action: { ...b.action, route: v } }
      if (field === 'action.url')         return { ...b, action: { ...b.action, url: v } }
      if (field === 'action.template_id') return { ...b, action: { ...b.action, template_id: v } }
      if (field === 'color') return { ...b, color: v || undefined }  // '' → remove a cor
      return { ...b, [field]: v }
    })
    setBtnCfg({ ...btnCfg, buttons: next })
    setPreviewKey(k => k + 1)
  }
  function removeBtn(i: number) {
    if (btnCfg.buttons.length <= 1) return
    setBtnCfg({ ...btnCfg, buttons: btnCfg.buttons.filter((_, bi) => bi !== i) })
  }

  // ── helpers: axes Y (gráficos) ──────────────────────────────────────────
  function updateAxesY(i: number, f: string, v: string) {
    const ny = [...meta.axes.y]; ny[i] = { ...ny[i], [f]: v }
    setMeta(prev => ({ ...prev, axes: { ...prev.axes, y: ny } }))
  }
  function addSerie() {
    const colors = ['#3b82f6','#f97316','#fbbf24','#8b5cf6']
    setMeta(prev => ({ ...prev, axes: { ...prev.axes, y: [...prev.axes.y, { field: `serie${prev.axes.y.length + 1}`, label: `Série ${prev.axes.y.length + 1}`, color: colors[prev.axes.y.length % colors.length] }] } }))
  }
  function removeSerie(i: number) {
    if (meta.axes.y.length <= 1) return
    setMeta(prev => ({ ...prev, axes: { ...prev.axes, y: prev.axes.y.filter((_, yi) => yi !== i) } }))
  }

  // ── helpers: date filter ────────────────────────────────────────────────
  const dateFlt = meta.date_filter ?? DEFAULT_DATE_FILTER

  function setDateFilter(patch: Partial<TemplateDateFilter>) {
    setMeta(prev => ({ ...prev, date_filter: { ...(prev.date_filter ?? DEFAULT_DATE_FILTER), ...patch } }))
  }

  function handleCustomRange(range: DateRange) {
    setDateFilter({
      default_from: range.from?.toISOString() ?? undefined,
      default_to:   range.to?.toISOString()   ?? undefined,
    })
  }

  const customRangeValue: DateRange = {
    from: dateFlt.default_from ? new Date(dateFlt.default_from) : null,
    to:   dateFlt.default_to   ? new Date(dateFlt.default_to)   : null,
  }

  // ── save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!meta.nome.trim()) return alert('Nome é obrigatório')
    const needsSQL = !['button'].includes(type)
    if (needsSQL && !meta.query.sql.includes(':empresas_filtradas')) {
      return alert('O SQL deve conter :empresas_filtradas para isolamento multiempresa')
    }
    setSaving(true)
    try {
      await fetch('/api/graficos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) })
      router.push('/graficos')
    } catch { alert('Erro ao salvar template') }
    finally { setSaving(false) }
  }

  // ── Seleção de preview ──────────────────────────────────────────────────
  function renderPreview() {
    switch (type) {
      case 'report':    return <ReportPreview   metadata={meta} key={previewKey} />
      case 'kpi':       return <KpiPreview      metadata={meta} key={previewKey} />
      case 'heatmap':   return <HeatmapPreview  metadata={meta} key={previewKey} />
      case 'waterfall': return <WaterfallPreview metadata={meta} key={previewKey} />
      case 'button':    return <ButtonPreview   metadata={meta} key={previewKey} />
      default:          return <ChartPreview    metadata={meta} key={previewKey} />
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title={`Novo Template${type === 'report' ? ' de Relatório' : type === 'kpi' ? ' KPI' : type === 'button' ? ' de Botões' : ' de Gráfico'}`}
        subtitle="Construtor SQL + Preview ao vivo"
        actions={
          <Button onClick={handleSave} loading={saving}>
            <Save size={14} />Salvar Template
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── SQL Editor ── */}
        <div className="w-1/2 border-r border-white/8 flex flex-col">
          <SQLEditor value={meta.query.sql} onChange={sql => update('query', { ...meta.query, sql })} />
        </div>

        {/* ── Preview + Config ── */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Preview */}
          <div className="h-[340px] border-b border-white/8 flex flex-col">
            {renderPreview()}
          </div>

          {/* Config scrollável */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* ── Info básica ── */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nome do Template"
                placeholder="Ex: KPI Vendas do Dia"
                value={meta.nome}
                onChange={e => update('nome', e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Categoria</label>
                <select
                  value={meta.categoria}
                  onChange={e => update('categoria', e.target.value)}
                  className="w-full bg-white/4 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#009c3b]/60"
                >
                  {['vendas','estoque','financeiro','operacional','geral'].map(c => (
                    <option key={c} value={c} className="bg-[#111]">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Tipo + Permissão ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Tipo de Widget</label>
                <div className="space-y-1.5">
                  <select
                    value={meta.permissions.min_role}
                    onChange={e => update('permissions', { min_role: e.target.value as UserRole })}
                    className="bg-white/4 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value} className="bg-[#111]">{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CHART_TYPES.map(t => {
                  const TIcon = t.icon
                  const active = type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => changeType(t.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                        active
                          ? 'text-white shadow-lg'
                          : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/8',
                      )}
                      style={active ? { backgroundColor: t.color + 'cc', boxShadow: `0 4px 14px ${t.color}33` } : {}}
                    >
                      <TIcon size={11} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Seção específica por tipo
            ══════════════════════════════════════════════════════════════ */}

            {/* ── RELATÓRIO ── */}
            {type === 'report' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Colunas</p>
                  <button type="button" onClick={addRepCol} className="flex items-center gap-1 text-xs text-[#009c3b] hover:text-[#00b548] transition-colors">
                    <Plus size={12} />Adicionar coluna
                  </button>
                </div>
                <div className="flex gap-2 mb-1.5 px-0.5">
                  {['Campo SQL','Rótulo','Formato','Align','Rodapé'].map(h => (
                    <span key={h} className="text-[10px] text-white/25 uppercase tracking-wider"
                          style={{ width: h === 'Campo SQL' ? 112 : h === 'Rótulo' ? 'auto' : h === 'Formato' ? 96 : h === 'Align' ? 64 : 96, flexGrow: h === 'Rótulo' ? 1 : 0 }}>
                      {h}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {repCols.map((col, i) => (
                    <ColRow key={i} col={col} index={i} total={repCols.length}
                      onChange={(f, v) => updateRepCol(i, f, v)}
                      onRemove={() => removeRepCol(i)} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-5 flex-wrap">
                  {([['show_totals','Linha de Totais'],['show_index','Nº da Linha']] as const).map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!meta.report_config?.[k]}
                        onChange={e => setRepFlag(k, e.target.checked)}
                        className="w-4 h-4 rounded accent-[#009c3b]" />
                      <span className="text-white/60 text-sm">{lbl}</span>
                    </label>
                  ))}
                  <button type="button" onClick={() => setPreviewKey(k => k + 1)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                    <RefreshCw size={12} />Preview
                  </button>
                </div>
              </div>
            )}

            {/* ── KPI CARD ── */}
            {type === 'kpi' && (
              <div>
                {/* Layout selector */}
                <div className="flex items-center gap-3 mb-4">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Layout</p>
                  <div className="flex gap-1.5">
                    {([['1','1 coluna'],['2','2 colunas'],['4','2×2 grade']] as const).map(([v, lbl]) => (
                      <button key={v} type="button"
                        onClick={() => setKpi({ ...kpiCfg, layout: v })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          kpiCfg.layout === v ? 'bg-[#f59e0b]/80 text-white' : 'bg-white/5 text-white/50 hover:text-white',
                        )}
                      >{lbl}</button>
                    ))}
                  </div>
                  <button type="button" onClick={addKpiMetric} disabled={kpiCfg.metrics.length >= 4}
                    className="ml-auto flex items-center gap-1 text-xs text-[#009c3b] hover:text-[#00b548] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <Plus size={12} />Adicionar métrica (máx. 4)
                  </button>
                </div>

                {/* Linhas de métrica */}
                <div className="space-y-3">
                  {kpiCfg.metrics.map((m, i) => (
                    <div key={i} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 space-y-2.5">
                      {/* Linha 1: ícone, campo, label, formato, cor, remover */}
                      <div className="flex items-center gap-2">
                        <IconPickerButton value={m.icon} onChange={v => updateKpiMetric(i, 'icon', v)} />
                        <input value={m.field} onChange={e => updateKpiMetric(i, 'field', e.target.value)}
                          placeholder="campo_sql"
                          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono w-28
                                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20" />
                        <input value={m.label} onChange={e => updateKpiMetric(i, 'label', e.target.value)}
                          placeholder="Rótulo"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs
                                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20" />
                        <select value={m.format ?? 'number'} onChange={e => updateKpiMetric(i, 'format', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-24">
                          {[{v:'number',l:'Número'},{v:'currency',l:'Moeda'},{v:'percent',l:'%'}].map(f => (
                            <option key={f.v} value={f.v} className="bg-[#111]">{f.l}</option>
                          ))}
                        </select>
                        <input type="color" value={m.color ?? '#009c3b'}
                          onChange={e => updateKpiMetric(i, 'color', e.target.value)}
                          className="w-9 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5" />
                        <button type="button" onClick={() => removeKpiMetric(i)}
                          disabled={kpiCfg.metrics.length <= 1}
                          className="text-red-400/30 hover:text-red-400 transition-colors disabled:opacity-20">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {/* Linha 2: delta + sparkline */}
                      <div className="flex items-center gap-2 pl-11">
                        <input value={m.delta_field ?? ''} onChange={e => updateKpiMetric(i, 'delta_field', e.target.value)}
                          placeholder="campo_delta (opcional)"
                          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono w-40
                                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20" />
                        <input value={m.delta_label ?? ''} onChange={e => updateKpiMetric(i, 'delta_label', e.target.value)}
                          placeholder="vs ontem"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs
                                     focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20" />
                        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <input type="checkbox" checked={!!m.sparkline}
                            onChange={e => updateKpiMetric(i, 'sparkline', e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-[#009c3b]" />
                          <span className="text-white/50 text-xs">Sparkline</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── HEATMAP — config de eixos ── */}
            {type === 'heatmap' && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Eixos</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Campo X (ex: hora)" placeholder="hora"
                    value={meta.axes.x.field} onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, field: e.target.value } } }))} />
                  <Input label="Label X" placeholder="Horário"
                    value={meta.axes.x.label} onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, label: e.target.value } } }))} />
                  <Input label="Campo Y (ex: dia_semana)" placeholder="dia_semana"
                    value={meta.axes.y[0]?.field ?? ''} onChange={e => updateAxesY(0, 'field', e.target.value)} />
                  <Input label="Label Y" placeholder="Dia"
                    value={meta.axes.y[0]?.label ?? ''} onChange={e => updateAxesY(0, 'label', e.target.value)} />
                  <Input label="Campo Valor (intensidade)" placeholder="litros"
                    value={meta.axes.y[1]?.field ?? ''} onChange={e => {
                      const ny = [...meta.axes.y]
                      ny[1] = { ...(ny[1] ?? { label: 'Valor' }), field: e.target.value }
                      setMeta(p => ({ ...p, axes: { ...p.axes, y: ny } }))
                    }} />
                  <Input label="Label Valor" placeholder="Volume (L)"
                    value={meta.axes.y[1]?.label ?? ''} onChange={e => {
                      const ny = [...meta.axes.y]
                      ny[1] = { ...(ny[1] ?? { field: 'valor' }), label: e.target.value }
                      setMeta(p => ({ ...p, axes: { ...p.axes, y: ny } }))
                    }} />
                </div>
              </div>
            )}

            {/* ── WATERFALL — config de eixos ── */}
            {type === 'waterfall' && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Eixos</p>
                <p className="text-white/30 text-xs">O SQL deve retornar uma coluna de categoria e uma de valor. A última linha com value=0 é tratada como total.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Campo Categoria" placeholder="componente"
                    value={meta.axes.x.field} onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, field: e.target.value } } }))} />
                  <Input label="Label" placeholder="Componente"
                    value={meta.axes.x.label} onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, label: e.target.value } } }))} />
                  <Input label="Campo Valor" placeholder="valor"
                    value={meta.axes.y[0]?.field ?? ''} onChange={e => updateAxesY(0, 'field', e.target.value)} />
                  <Input label="Label Valor" placeholder="Valor (R$)"
                    value={meta.axes.y[0]?.label ?? ''} onChange={e => updateAxesY(0, 'label', e.target.value)} />
                </div>
              </div>
            )}

            {/* ── BOTÕES ── */}
            {type === 'button' && (
              <div>
                {/* Layout */}
                <div className="flex items-center gap-3 mb-4">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Layout</p>
                  <div className="flex gap-1.5">
                    {([['horizontal','Horizontal'],['vertical','Vertical'],['grid','Grade']] as const).map(([v, lbl]) => (
                      <button key={v} type="button"
                        onClick={() => setBtnCfg({ ...btnCfg, layout: v })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          btnCfg.layout === v ? 'bg-[#f43f5e]/80 text-white' : 'bg-white/5 text-white/50 hover:text-white',
                        )}
                      >{lbl}</button>
                    ))}
                  </div>
                  <button type="button" onClick={addBtn}
                    className="ml-auto flex items-center gap-1 text-xs text-[#009c3b] hover:text-[#00b548] transition-colors">
                    <Plus size={12} />Adicionar botão
                  </button>
                </div>

                {/* Linhas */}
                <div className="space-y-2">
                  {btnCfg.buttons.map((btn, i) => (
                    <BtnRow key={i} btn={btn} index={i} total={btnCfg.buttons.length}
                      onChange={(f, v) => updateBtn(i, f, v)}
                      onRemove={() => removeBtn(i)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── GRÁFICOS CLÁSSICOS — eixos + display ── */}
            {!['report','kpi','heatmap','waterfall','button'].includes(type) && (
              <>
                {/* Altura */}
                <div className="flex items-center gap-3">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Altura</p>
                  <div className="flex gap-1.5">
                    {(['sm','md','lg'] as const).map(h => (
                      <button key={h} type="button" onClick={() => update('display', { ...meta.display, height: h })}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', meta.display.height === h ? 'bg-[#009c3b] text-white' : 'bg-white/5 text-white/50 hover:text-white')}>
                        {h.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Eixo X */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Eixo X</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Campo SQL" placeholder="hora" value={meta.axes.x.field}
                      onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, field: e.target.value } } }))} />
                    <Input label="Label" placeholder="Hora do Dia" value={meta.axes.x.label}
                      onChange={e => setMeta(p => ({ ...p, axes: { ...p.axes, x: { ...p.axes.x, label: e.target.value } } }))} />
                  </div>
                </div>
                {/* Séries Y */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Séries (Y)</p>
                    <button type="button" onClick={addSerie} className="flex items-center gap-1 text-xs text-[#009c3b] hover:text-[#00b548] transition-colors">
                      <Plus size={12} />Adicionar série
                    </button>
                  </div>
                  <div className="space-y-2">
                    {meta.axes.y.map((y, i) => (
                      <div key={i} className="flex gap-2 items-end">
                        <Input label={i === 0 ? 'Campo SQL' : undefined} placeholder="campo" value={y.field}
                          onChange={e => updateAxesY(i, 'field', e.target.value)} className="flex-1" />
                        <Input label={i === 0 ? 'Label' : undefined} placeholder="Nome" value={y.label}
                          onChange={e => updateAxesY(i, 'label', e.target.value)} className="flex-1" />
                        <input type="color" value={y.color ?? '#009c3b'} onChange={e => updateAxesY(i, 'color', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                        {meta.axes.y.length > 1 && (
                          <button type="button" onClick={() => removeSerie(i)} className="pb-1 text-red-400/50 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Display flags */}
                <div className="flex gap-4 flex-wrap">
                  {[['show_legend','Legenda'],['show_tooltip','Tooltip'],['gradient','Gradiente']].map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!meta.display[k as keyof typeof meta.display]}
                        onChange={e => update('display', { ...meta.display, [k]: e.target.checked })}
                        className="w-4 h-4 rounded accent-[#009c3b]" />
                      <span className="text-white/60 text-sm">{lbl}</span>
                    </label>
                  ))}
                  <button type="button" onClick={() => setPreviewKey(k => k + 1)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                    <RefreshCw size={12} />Atualizar preview
                  </button>
                </div>
              </>
            )}

            {/* ── FILTRO DE DATA — sempre visível exceto button ── */}
            {type !== 'button' && (
              <div className="border border-white/8 rounded-xl overflow-hidden">
                {/* Header clicável */}
                <button
                  type="button"
                  onClick={() => setDateFilter({ enabled: !dateFlt.enabled })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all',
                    dateFlt.enabled
                      ? 'bg-[#009c3b]/20 border-[#009c3b]/40 text-[#009c3b]'
                      : 'bg-white/5 border-white/10 text-white/30',
                  )}>
                    <CalendarRange size={14} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={cn('text-sm font-medium transition-colors', dateFlt.enabled ? 'text-white' : 'text-white/50')}>
                      Filtro de Período
                    </p>
                    <p className="text-white/30 text-xs">
                      {dateFlt.enabled
                        ? 'Ativo — parâmetros de data injetados no SQL'
                        : 'Inativo — clique para ativar'}
                    </p>
                  </div>
                  {/* Toggle */}
                  <div className={cn(
                    'w-9 h-5 rounded-full relative transition-all flex-shrink-0',
                    dateFlt.enabled ? 'bg-[#009c3b]' : 'bg-white/15',
                  )}>
                    <div className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                      dateFlt.enabled ? 'left-[18px]' : 'left-0.5',
                    )} />
                  </div>
                </button>

                {/* Corpo (visível quando ativo) */}
                {dateFlt.enabled && (
                  <div className="border-t border-white/8 px-4 py-4 space-y-4 bg-white/[0.01]">

                    {/* Parâmetros SQL */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">
                        Parâmetros no SQL
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Data Início</label>
                          <input
                            value={dateFlt.param_inicio}
                            onChange={e => setDateFilter({ param_inicio: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono
                                       focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Data Fim</label>
                          <input
                            value={dateFlt.param_fim}
                            onChange={e => setDateFilter({ param_fim: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono
                                       focus:outline-none focus:border-[#009c3b]/50 placeholder:text-white/20"
                          />
                        </div>
                      </div>
                      <p className="text-white/25 text-[10px] mt-1.5">
                        Use esses nomes no SQL · Ex:{' '}
                        <code className="text-green-400/60 font-mono">
                          WHERE data BETWEEN {dateFlt.param_inicio} AND {dateFlt.param_fim}
                        </code>
                      </p>
                    </div>

                    {/* Período padrão */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">
                        Período padrão ao abrir
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {DATE_PRESETS.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setDateFilter({ default_preset: p.value })}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                              dateFlt.default_preset === p.value
                                ? 'bg-[#009c3b]/80 text-white shadow-md shadow-[#009c3b]/20'
                                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/8',
                            )}
                          >
                            {p.value === 'custom' && <Calendar size={10} />}
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* DateRangePicker quando preset = custom */}
                      {dateFlt.default_preset === 'custom' && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-white/40 text-xs">Data fixa:</span>
                          <DateRangePicker
                            value={customRangeValue}
                            onChange={handleCustomRange}
                            placeholder="Escolher datas..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Refresh / Timeout — sempre visível (exceto button) ── */}
            {type !== 'button' && (
              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/8">
                <Input label="Refresh (segundos)" type="number" value={meta.query.refresh_seconds}
                  onChange={e => update('query', { ...meta.query, refresh_seconds: +e.target.value })} />
                <Input label="Timeout (segundos)" type="number" value={meta.query.timeout_seconds}
                  onChange={e => update('query', { ...meta.query, timeout_seconds: +e.target.value })} />
              </div>
            )}

          </div>{/* fim config scrollável */}
        </div>
      </div>
    </div>
  )
}
