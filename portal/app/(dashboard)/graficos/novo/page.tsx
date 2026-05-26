'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast, Toaster } from '@/components/ui/Toast'
import { SQLEditor }       from '@/components/sql-builder/SQLEditor'
import { ChartPreview }    from '@/components/charts/ChartPreview'
import { ReportPreview }   from '@/components/reports/ReportPreview'
import { KpiPreview }      from '@/components/charts/KpiPreview'
import { HeatmapPreview }  from '@/components/charts/HeatmapPreview'
import { WaterfallPreview} from '@/components/charts/WaterfallPreview'
import { ButtonPreview }   from '@/components/charts/ButtonPreview'
import { TankPreview }       from '@/components/charts/TankPreview'
import { MultiBlockPreview } from '@/components/charts/MultiBlockPreview'
import { MultiblockEditor }  from '@/components/charts/MultiblockEditor'
import { IconPicker }        from '@/components/charts/IconPicker'
import { TopBar }  from '@/components/layout/TopBar'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SqlDataTable }     from '@/components/ui/SqlDataTable'
import { ChartSuggestions } from '@/components/charts/ChartSuggestions'
import { cn }      from '@/lib/cn'
import { ICON_NAMES, ICON_REGISTRY } from '@/lib/icons'
import {
  Save, Plus, Trash2, RefreshCw, Calendar, CalendarRange, GripVertical,
  TableProperties, BarChart3, Activity, Flame, Layers, MousePointerClick, Fuel,
  Play, CheckCircle2, AlertCircle, Wand2, Wifi, WifiOff, ChevronDown,
} from 'lucide-react'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import type { DateRange } from '@/components/ui/DateRangePicker'
import type {
  ChartMetadata, ChartType, UserRole,
  ReportColumn, ReportColumnFormat, ReportSummaryFn,
  KpiMetric, KpiConfig,
  ButtonWidgetItem, ButtonWidgetConfig, ButtonVariant, ButtonSize,
  TankConfig,
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
  { value: 'tank',      label: 'Tanques',   icon: Fuel,               color: '#009c3b' },
  { value: 'multiblock',label: 'Multibloco',icon: Layers,             color: '#a855f7' },
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

const DEFAULT_TANK: TankConfig = {
  field_produto:    'produto',
  field_volume:     'volume_atual',
  field_capacidade: 'capacidade_total',
  field_disponivel: 'espaco_disponivel',
  field_percentual: '',
  unidade:          'L',
  threshold_low:    25,
  threshold_mid:    50,
  colunas:          1,
}

const DEFAULT_DATE_FILTER: TemplateDateFilter = {
  enabled:        false,
  filter_type:    'date',
  param_inicio:   ':data_inicio',
  param_fim:      ':data_fim',
  default_preset: 'last_30d',
}

const DATE_FILTER_PRESETS: Record<'date' | 'datetime', { param_inicio: string; param_fim: string; label: string; hint: string }> = {
  date: {
    param_inicio: ':data_inicio',
    param_fim:    ':data_fim',
    label:        'Data (DD/MM/YYYY)',
    hint:         'YYYY-MM-DD — ideal para campos DATE do PostgreSQL',
  },
  datetime: {
    param_inicio: ':datetime_inicio',
    param_fim:    ':datetime_fim',
    label:        'Data + Hora (DD/MM/YYYY HH:MM:SS)',
    hint:         'Início: 00:00:00 · Fim: 23:59:59 — ideal para campos TIMESTAMP',
  },
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
  categoria: 'operacoes',
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
  tank_config:   DEFAULT_TANK,
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
// Sub-componente — linha de coluna do Relatório (com drag-and-drop nativo HTML5)
// ─────────────────────────────────────────────────────────────────────────────
function ColRow({
  col, index, total, onChange, onRemove, onMove,
  dragOverIndex, setDragOverIndex,
  draggingIndex, setDraggingIndex,
}: {
  col:      ReportColumn
  index:    number
  total:    number
  onChange: (f: keyof ReportColumn, v: string) => void
  onRemove: () => void
  onMove:   (from: number, to: number) => void
  dragOverIndex: number | null
  setDragOverIndex: (i: number | null) => void
  draggingIndex:    number | null
  setDraggingIndex: (i: number | null) => void
}) {
  const isDragging = draggingIndex === index
  const isOver     = dragOverIndex === index && draggingIndex !== null && draggingIndex !== index
  const indicateAbove = isOver && (draggingIndex! > index)
  const indicateBelow = isOver && (draggingIndex! < index)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(index) }}
      onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null) }}
      onDrop={(e) => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/col-index'))
        if (Number.isFinite(from) && from !== index) onMove(from, index)
        setDragOverIndex(null)
        setDraggingIndex(null)
      }}
      className={cn(
        'flex items-center gap-2 group/row rounded-lg transition-all',
        isDragging && 'opacity-40',
        indicateAbove && 'border-t-2 border-t-[#009c3b]',
        indicateBelow && 'border-b-2 border-b-[#009c3b]',
      )}
    >
      {/* Drag handle */}
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/col-index', String(index))
          setDraggingIndex(index)
        }}
        onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null) }}
        className="cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 p-1 -ml-1 select-none"
        title="Arrastar pra reordenar"
      >
        <GripVertical size={14} />
      </span>

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

// Wrapper que gerencia drag state pro reorder das colunas
function ColListSortable({
  cols, setRepCols, updateRepCol, removeRepCol,
}: {
  cols: ReportColumn[]
  setRepCols: (cols: ReportColumn[]) => void
  updateRepCol: (i: number, f: keyof ReportColumn, v: string) => void
  removeRepCol: (i: number) => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= cols.length || to >= cols.length) return
    const next = [...cols]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setRepCols(next)
  }

  return (
    <div className="space-y-2">
      {cols.map((col, i) => (
        <ColRow
          key={i}
          col={col}
          index={i}
          total={cols.length}
          onChange={(f, v) => updateRepCol(i, f, v)}
          onRemove={() => removeRepCol(i)}
          onMove={move}
          dragOverIndex={dragOverIndex}
          setDragOverIndex={setDragOverIndex}
          draggingIndex={draggingIndex}
          setDraggingIndex={setDraggingIndex}
        />
      ))}
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
function NovoGraficoContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const editId       = searchParams.get('edit')   // editar template existente
  const fromId       = searchParams.get('from')   // duplicar template
  const isEditing    = !!editId && !editId.startsWith('tmpl-') // tmpl-* → cria novo no DB

  const { toasts, toast, dismiss } = useToast()
  const [meta,       setMeta]       = useState<ChartMetadata>(DEFAULT_META)
  const [saving,     setSaving]     = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // ── SQL test state ──────────────────────────────────────────────────────────
  const [sqlResult,  setSqlResult]  = useState<{
    columns:       string[]
    rows:          Record<string, unknown>[]
    count:         number
    empty?:        boolean
    empresas_ids?: number[]
    prepared_sql?: string
    hint?:         string
  } | null>(null)
  const [sqlError,   setSqlError]   = useState<string | null>(null)
  const [sqlRunning, setSqlRunning] = useState(false)

  // ── Clientes online para testar via agente ───────────────────────────────────
  type ClienteOnline = { id: string; nome: string; agenteStatus?: string; agente_status?: string }
  const [clientes,        setClientes]        = useState<ClienteOnline[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [agentRunning,    setAgentRunning]    = useState(false)

  // ── Carrega template existente para editar ou duplicar ───────────────────
  useEffect(() => {
    const id = editId ?? fromId
    if (!id) return
    setLoadingTemplate(true)
    fetch(`/api/graficos/${id}`)
      .then(r => r.json())
      .then((data: { template?: ChartMetadata }) => {
        if (!data.template) { toast('Template não encontrado', 'error'); return }
        setMeta({
          ...data.template,
          id:   fromId ? '' : (data.template.id ?? ''),
          nome: fromId ? `(Cópia) ${data.template.nome}` : data.template.nome,
        })
        setPreviewKey(k => k + 1)
      })
      .catch(() => toast('Erro ao carregar template', 'error'))
      .finally(() => setLoadingTemplate(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      tank_config:   prev.tank_config   ?? DEFAULT_TANK,
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
    setMeta(prev => {
      const current = prev.date_filter ?? DEFAULT_DATE_FILTER
      const merged  = { ...current, ...patch }
      // Quando filter_type muda, auto-preenche os nomes de parâmetro padrão
      // (só se o usuário ainda está usando os nomes padrão)
      if (patch.filter_type && patch.filter_type !== current.filter_type) {
        const preset = DATE_FILTER_PRESETS[patch.filter_type]
        const isDefaultInicio = [':data_inicio', ':datetime_inicio'].includes(current.param_inicio)
        const isDefaultFim    = [':data_fim',    ':datetime_fim'   ].includes(current.param_fim)
        if (isDefaultInicio) merged.param_inicio = preset.param_inicio
        if (isDefaultFim)    merged.param_fim    = preset.param_fim
      }
      return { ...prev, date_filter: merged }
    })
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
    if (!meta.nome.trim()) {
      toast('Nome é obrigatório', 'error')
      return
    }
    const needsSQL = !['button', 'tank'].includes(type)
    if (needsSQL && !meta.query.sql.includes(':empresas_filtradas')) {
      toast('O SQL deve conter :empresas_filtradas para isolamento multiempresa', 'warning')
      return
    }
    setSaving(true)
    try {
      if (isEditing && editId) {
        // Atualiza template existente no DB
        const res = await fetch(`/api/graficos/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
        })
        if (!res.ok) { const d = await res.json(); toast(d.error ?? 'Erro ao atualizar', 'error'); return }
        toast('Template atualizado com sucesso!', 'success')
      } else {
        // Cria novo (inclui duplicar e editar template do sistema)
        const res = await fetch('/api/graficos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
        })
        if (!res.ok) { const d = await res.json(); toast(d.error ?? 'Erro ao salvar', 'error'); return }
        toast(fromId ? 'Cópia criada com sucesso!' : 'Template criado com sucesso!', 'success')
      }
      setTimeout(() => router.push('/graficos'), 1200)
    } catch {
      toast('Erro ao salvar template', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Carrega clientes com agente online ──────────────────────────────────────
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then((d: { clientes?: ClienteOnline[] }) => {
        const online = (d.clientes ?? []).filter(c => (c.agenteStatus ?? c.agente_status) === 'online')
        setClientes(online)
        if (online.length > 0 && !selectedCliente) setSelectedCliente(online[0].id)
      })
      .catch(() => {/* silencioso */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Testar SQL ──────────────────────────────────────────────────────────────
  async function handleTestSQL() {
    if (!meta.query.sql.trim()) {
      toast('Digite um SQL antes de testar', 'warning')
      return
    }
    setSqlRunning(true)
    setSqlError(null)
    setSqlResult(null)
    try {
      const res = await fetch('/api/graficos/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sql: meta.query.sql }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSqlError(data.error ?? 'Erro desconhecido')
        return
      }
      setSqlResult(data)
      setPreviewKey(k => k + 1)
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSqlRunning(false)
    }
  }

  // ── Testar SQL via Agente do cliente ─────────────────────────────────────────
  async function handleAgentPreview() {
    if (!meta.query.sql.trim()) {
      toast('Digite um SQL antes de testar', 'warning')
      return
    }
    if (!selectedCliente) {
      toast('Selecione um cliente com agente online', 'warning')
      return
    }
    setAgentRunning(true)
    setSqlError(null)
    setSqlResult(null)
    try {
      const res = await fetch('/api/graficos/agent-preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sql: meta.query.sql, cliente_id: selectedCliente }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSqlError(data.error ?? 'Erro do agente')
        return
      }
      setSqlResult(data)
      setPreviewKey(k => k + 1)
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setAgentRunning(false)
    }
  }

  // ── Auto-preencher campos a partir das colunas do SQL ───────────────────────
  function guessFormat(col: string): string {
    const c = col.toLowerCase()
    if (c.includes('valor') || c.includes('preco') || c.includes('preço') || c.includes('total') || c.includes('fat') || c.includes('receita') || c.includes('custo')) return 'currency'
    if (c.includes('percent') || c.includes('pct') || c.includes('margem') || c.includes('taxa')) return 'percent'
    if (c.includes('data') || c.includes('date') || c === 'dt') return 'date'
    if (c.includes('hora') || c.includes('time') || c.includes('datetime') || c.includes('created') || c.includes('updated')) return 'datetime'
    if (c.includes('qtd') || c.includes('quantidade') || c.includes('volume') || c.includes('litros') || c.includes('count') || c.includes('num') || c.includes('abast')) return 'number'
    return 'text'
  }

  function autoFillFields() {
    if (!sqlResult?.columns?.length) return
    const cols = sqlResult.columns

    if (type === 'report') {
      const newCols = cols.map(c => ({
        field:   c,
        label:   c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        format:  guessFormat(c) as import('@/lib/types').ReportColumnFormat,
        align:   (['currency','number','percent'].includes(guessFormat(c)) ? 'right' : 'left') as 'left' | 'right' | 'center',
        summary: (['currency','number'].includes(guessFormat(c)) ? 'sum' : 'none') as import('@/lib/types').ReportSummaryFn,
      }))
      setMeta(prev => ({ ...prev, report_config: { ...(prev.report_config ?? { show_totals: true, show_index: false }), columns: newCols } }))
      toast(`${newCols.length} colunas preenchidas`, 'success')

    } else if (type === 'kpi') {
      const metricCols = cols.slice(0, 4)
      const newMetrics = metricCols.map((c, i) => ({
        field:     c,
        label:     c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        format:    (guessFormat(c) === 'currency' ? 'currency' : guessFormat(c) === 'percent' ? 'percent' : 'number') as import('@/lib/types').KpiMetric['format'],
        icon:      'BarChart3',
        color:     ['#009c3b','#3b82f6','#f59e0b','#8b5cf6'][i % 4],
        sparkline: false,
      }))
      setMeta(prev => ({ ...prev, kpi_config: { ...(prev.kpi_config ?? DEFAULT_KPI), metrics: newMetrics } }))
      toast(`${newMetrics.length} métricas preenchidas`, 'success')

    } else if (type === 'multiblock') {
      // Heurísticas: 1ª textual = groupBy; numéricas = KPIs (até 3) + donut + tabela
      const numericCol = (c: string) => ['number','currency','percent'].includes(guessFormat(c))
      const textCol    = cols.find(c => !numericCol(c)) ?? cols[0]
      const numCols    = cols.filter(c => numericCol(c))

      const blocks: import('@/lib/types').MultiBlock[] = []
      // 3 KPIs primeiros campos numéricos
      numCols.slice(0, 3).forEach((c, i) => {
        const fmt = guessFormat(c)
        blocks.push({
          type: 'kpi',
          title: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          field: c,
          agg: 'sum',
          format: (fmt === 'currency' ? 'currency' : fmt === 'percent' ? 'percent' : fmt === 'number' ? 'number' : 'number') as import('@/lib/types').KpiFormat,
          color: ['#009c3b','#3b82f6','#f59e0b'][i] ?? '#009c3b',
        })
      })
      // Donut por categoria
      if (textCol && numCols[0]) {
        blocks.push({
          type: 'donut',
          title: `${textCol} × ${numCols[0]}`,
          groupBy: textCol,
          valueField: numCols[0],
          valueAgg: 'sum',
          showLegend: true,
        })
      }
      // Tabela com tudo
      blocks.push({
        type: 'table',
        title: 'Detalhes',
        columns: cols.map(c => ({
          field: c,
          label: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          format: guessFormat(c) as import('@/lib/types').ReportColumnFormat,
          align: (numericCol(c) ? 'right' : 'left') as 'left' | 'right' | 'center',
          summary: (numericCol(c) ? 'sum' : 'none') as import('@/lib/types').ReportSummaryFn,
        })),
        showTotals: true,
        maxRows: 20,
      })

      setMeta(prev => ({ ...prev, multiblock_config: { blocks, layout: { preset: 'kpis-top' } } }))
      toast(`${blocks.length} blocos preenchidos`, 'success')

    } else if (type === 'tank') {
      const find = (hints: string[]) => cols.find(c => hints.some(h => c.toLowerCase().includes(h)))
      setMeta(prev => ({
        ...prev,
        tank_config: {
          ...(prev.tank_config ?? DEFAULT_TANK),
          field_produto:    find(['produto','nome','name','combustivel','combustível']) ?? prev.tank_config?.field_produto ?? 'produto',
          field_volume:     find(['volume','atual','estoque','litros']) ?? prev.tank_config?.field_volume ?? 'volume_atual',
          field_capacidade: find(['capacidade','capacity','total','max']) ?? prev.tank_config?.field_capacidade ?? 'capacidade_total',
          field_disponivel: find(['disponivel','disponível','available','livre']) ?? prev.tank_config?.field_disponivel,
          field_percentual: find(['percent','pct','percentual','nivel','nível']) ?? prev.tank_config?.field_percentual,
        },
      }))
      toast('Campos do tanque preenchidos', 'success')

    } else {
      const numericCol  = (c: string) => ['number','currency','percent'].includes(guessFormat(c))
      const xCandidate  = cols.find(c => !numericCol(c)) ?? cols[0]
      const yCandidates = cols.filter(c => c !== xCandidate && numericCol(c))
      if (yCandidates.length === 0 && cols.length > 1) yCandidates.push(...cols.filter(c => c !== xCandidate))

      const yAxes = (yCandidates.length > 0 ? yCandidates : [cols[1] ?? cols[0]]).map((c, i) => ({
        field: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: ['#009c3b','#3b82f6','#f97316','#fbbf24','#8b5cf6'][i % 5],
      }))

      setMeta(prev => ({
        ...prev,
        axes: {
          x: { field: xCandidate, label: xCandidate.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) },
          y: yAxes,
        },
      }))
      toast('Eixos preenchidos automaticamente', 'success')
    }

    setPreviewKey(k => k + 1)
  }

  // ── Seleção de preview ──────────────────────────────────────────────────
  function renderPreview() {
    switch (type) {
      case 'report':    return <ReportPreview   metadata={meta} key={previewKey} realData={sqlResult} />
      case 'kpi':       return <KpiPreview      metadata={meta} key={previewKey} />
      case 'heatmap':   return <HeatmapPreview  metadata={meta} key={previewKey} />
      case 'waterfall': return <WaterfallPreview metadata={meta} key={previewKey} />
      case 'button':    return <ButtonPreview   metadata={meta} key={previewKey} />
      case 'tank':       return <TankPreview       metadata={meta} key={previewKey} />
      case 'multiblock': return <MultiBlockPreview metadata={meta} key={previewKey} realData={sqlResult} />
      default:          return <ChartPreview    metadata={meta} key={previewKey} />
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title={
          isEditing ? 'Editar Template'
          : fromId  ? 'Duplicar Template'
          : `Novo Template${type === 'report' ? ' de Relatório' : type === 'kpi' ? ' KPI' : type === 'button' ? ' de Botões' : type === 'tank' ? ' de Tanques' : ' de Gráfico'}`
        }
        subtitle={loadingTemplate ? 'Carregando…' : 'Construtor SQL + Preview ao vivo'}
        actions={
          <Button onClick={handleSave} loading={saving} disabled={loadingTemplate}>
            <Save size={14} />{isEditing ? 'Salvar Alterações' : fromId ? 'Criar Cópia' : 'Salvar Template'}
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── SQL Editor ── */}
        <div className="w-1/2 border-r border-white/8 flex flex-col overflow-hidden isolate">
          {/* Editor — isolate + relative + overflow-hidden contém Monaco (absolute) */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <SQLEditor value={meta.query.sql} onChange={sql => update('query', { ...meta.query, sql })} />
          </div>

          {/* ── Barra de ação SQL ── */}
          <div className="border-t border-white/8 px-4 py-2 flex items-center gap-2.5 bg-white/[0.02] flex-shrink-0">

            {/* Testar no banco do portal */}
            <button
              type="button"
              onClick={handleTestSQL}
              disabled={sqlRunning || agentRunning}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0',
                sqlRunning
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-[#009c3b] hover:bg-[#00b548] text-white shadow-md shadow-[#009c3b]/20',
              )}
            >
              <Play size={11} className={sqlRunning ? 'animate-pulse' : ''} />
              {sqlRunning ? 'Executando…' : 'Testar SQL'}
            </button>

            {/* Indicador de resultado */}
            {sqlResult && !sqlRunning && !agentRunning && (
              <span className="flex items-center gap-1 text-xs text-[#009c3b] flex-shrink-0">
                <CheckCircle2 size={12} />
                {sqlResult.count} linha{sqlResult.count !== 1 ? 's' : ''} · {sqlResult.columns.length} col
              </span>
            )}

            {/* Erro */}
            {sqlError && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 min-w-0 max-w-[200px]">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span className="truncate font-mono">{sqlError}</span>
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Auto-preencher (só quando há resultado) */}
            {sqlResult && !['button'].includes(type) && (
              <button
                type="button"
                onClick={autoFillFields}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:bg-[#009c3b]/15 hover:text-[#009c3b] transition-all border border-white/8 hover:border-[#009c3b]/30 flex-shrink-0"
              >
                <Wand2 size={11} />
                Auto-preencher
              </button>
            )}

            {/* Separador vertical */}
            <div className="w-px h-4 bg-white/10 flex-shrink-0" />

            {/* Seção do agente */}
            {clientes.length === 0 ? (
              <span className="flex items-center gap-1.5 text-xs text-white/25 flex-shrink-0">
                <WifiOff size={11} />
                Nenhum agente
              </span>
            ) : (
              <>
                <select
                  value={selectedCliente}
                  onChange={e => setSelectedCliente(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#009c3b]/40 max-w-[150px] flex-shrink-0"
                >
                  {clientes.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#111]">{c.nome}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAgentPreview}
                  disabled={agentRunning || sqlRunning}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0',
                    agentRunning
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-emerald-700/80 hover:bg-emerald-600 text-white shadow-md shadow-emerald-900/30',
                  )}
                >
                  <Wifi size={11} className={agentRunning ? 'animate-pulse' : ''} />
                  {agentRunning ? 'Aguardando…' : 'Via Agente'}
                </button>
              </>
            )}
          </div>

          {/* ── Banner de aviso: 0 linhas (não é erro, mas confunde) ── */}
          {sqlResult && sqlResult.empty && (
            <div className="flex-shrink-0 border-t border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2">
              <div className="flex items-start gap-2 text-amber-300 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Query executou sem erro mas retornou 0 linhas</div>
                  <div className="text-white/60">
                    {sqlResult.hint ?? 'Verifique filtros, períodos e códigos ERP.'}
                  </div>
                  {sqlResult.empresas_ids && (
                    <div className="text-white/50 font-mono">
                      Substituído <span className="text-amber-300">:empresas_filtradas</span> → {sqlResult.empresas_ids.join(', ')}
                    </div>
                  )}
                </div>
              </div>
              {sqlResult.prepared_sql && (
                <details className="group">
                  <summary className="cursor-pointer text-[11px] text-amber-300/70 hover:text-amber-300 select-none">
                    ▸ Ver SQL preparado (com placeholders substituídos)
                  </summary>
                  <pre className="mt-2 p-3 bg-black/40 border border-amber-500/20 rounded text-[11px] text-white/70 font-mono overflow-auto max-h-[200px]">
                    {sqlResult.prepared_sql}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* ── Sugestões automáticas de tipo de gráfico ── */}
          {sqlResult && sqlResult.columns.length > 0 && (
            <ChartSuggestions
              columns={sqlResult.columns}
              rows={sqlResult.rows}
              current={type}
              onPick={(t) => {
                changeType(t)
                // Auto-preencher depois da troca pra carregar campos baseado nas colunas
                setTimeout(() => autoFillFields(), 50)
              }}
            />
          )}

          {/* ── Resultado da query (viewer maior + expandir + copiar) ── */}
          {sqlResult && sqlResult.columns.length > 0 && (
            <SqlDataTable
              data={sqlResult}
              maxHeight="420px"
              rowLimit={100}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* ── Preview + Config ── */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Preview */}
          <div className="h-[340px] border-b border-white/8 flex flex-col">
            <ErrorBoundary>
              {renderPreview()}
            </ErrorBoundary>
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
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
                  Menu do PWA <span className="text-white/30 normal-case text-[10px]">— onde este relatório aparece</span>
                </label>
                <select
                  value={meta.categoria}
                  onChange={e => update('categoria', e.target.value)}
                  className="w-full bg-white/4 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#009c3b]/60"
                >
                  {[
                    { id: 'iniciar',    label: 'Iniciar (tela inicial)' },
                    { id: 'pista',      label: 'Pista' },
                    { id: 'estoque',    label: 'Estoque' },
                    { id: 'vendas',     label: 'Vendas' },
                    { id: 'financeiro', label: 'Financeiro' },
                    { id: 'operacoes',  label: 'Operações' },
                  ].map(o => (
                    <option key={o.id} value={o.id} className="bg-[#111]">{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ícone + cores do card no PWA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
                Ícone do card no PWA
              </label>
              <IconPicker
                iconName={meta.display.icon}
                iconBg={meta.display.icon_bg}
                iconColor={meta.display.icon_color}
                onChange={patch => setMeta(prev => ({
                  ...prev,
                  display: { ...prev.display, ...patch },
                }))}
              />
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
                <ColListSortable
                  cols={repCols}
                  setRepCols={setRepCols}
                  updateRepCol={updateRepCol}
                  removeRepCol={removeRepCol}
                />
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

            {/* ── MULTIBLOCK ── */}
            {type === 'multiblock' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-white/8">
                  <Layers size={14} className="text-purple-400" />
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Blocos do Multibloco</p>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  1 SQL no editor (esquerda) gera todos os blocos abaixo. Rode "Via Agente" primeiro pra carregar as colunas, depois adicione blocos.
                </p>
                <MultiblockEditor
                  config={meta.multiblock_config}
                  columns={sqlResult?.columns ?? []}
                  onChange={cfg => setMeta(prev => ({ ...prev, multiblock_config: cfg }))}
                />
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

            {/* ── TANQUES ── */}
            {type === 'tank' && (
              <div className="space-y-5">
                {/* Campos SQL */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Campos SQL</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Produto (nome)"     placeholder="produto"
                      value={meta.tank_config?.field_produto    ?? 'produto'}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), field_produto: e.target.value } }))} />
                    <Input label="Volume Atual"        placeholder="volume_atual"
                      value={meta.tank_config?.field_volume     ?? 'volume_atual'}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), field_volume: e.target.value } }))} />
                    <Input label="Capacidade Total"    placeholder="capacidade_total"
                      value={meta.tank_config?.field_capacidade ?? 'capacidade_total'}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), field_capacidade: e.target.value } }))} />
                    <Input label="Disponível (opcional)" placeholder="espaco_disponivel"
                      value={meta.tank_config?.field_disponivel ?? ''}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), field_disponivel: e.target.value || undefined } }))} />
                    <Input label="Percentual (opcional)" placeholder="calculado auto"
                      value={meta.tank_config?.field_percentual ?? ''}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), field_percentual: e.target.value || undefined } }))} />
                    <Input label="Unidade"             placeholder="L"
                      value={meta.tank_config?.unidade          ?? 'L'}
                      onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), unidade: e.target.value } }))} />
                  </div>
                  <p className="text-white/25 text-[10px] mt-2">
                    Se <span className="text-white/40 font-mono">Disponível</span> não for informado, será calculado como{' '}
                    <span className="text-[#009c3b]/70 font-mono">capacidade − volume</span>.
                    Se <span className="text-white/40 font-mono">Percentual</span> não for informado, será{' '}
                    <span className="text-[#009c3b]/70 font-mono">volume / capacidade × 100</span>.
                  </p>
                </div>

                {/* Limiares de cor */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Limiares de Cor</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#ef4444] flex-shrink-0" />
                      <span className="text-white/50 text-xs">Crítico abaixo de</span>
                      <input
                        type="number" min={1} max={99}
                        value={meta.tank_config?.threshold_low ?? 25}
                        onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), threshold_low: +e.target.value } }))}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-[#ef4444]/50"
                      />
                      <span className="text-white/30 text-xs">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#eab308] flex-shrink-0" />
                      <span className="text-white/50 text-xs">Alerta abaixo de</span>
                      <input
                        type="number" min={1} max={99}
                        value={meta.tank_config?.threshold_mid ?? 50}
                        onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), threshold_mid: +e.target.value } }))}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-[#eab308]/50"
                      />
                      <span className="text-white/30 text-xs">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#009c3b] flex-shrink-0" />
                      <span className="text-white/40 text-xs">Normal acima</span>
                    </div>
                  </div>
                </div>

                {/* Tamanhos de Fonte */}
                <div>
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Tamanho de Fonte</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider">Produto (px)</label>
                      <input
                        type="number" min={8} max={24}
                        value={meta.tank_config?.font_size_produto ?? 12}
                        onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), font_size_produto: +e.target.value } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs text-center focus:outline-none focus:border-[#009c3b]/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider">Volume (px)</label>
                      <input
                        type="number" min={12} max={48}
                        value={meta.tank_config?.font_size_volume ?? 22}
                        onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), font_size_volume: +e.target.value } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs text-center focus:outline-none focus:border-[#009c3b]/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider">% Badge (px)</label>
                      <input
                        type="number" min={7} max={20}
                        value={meta.tank_config?.font_size_percentual ?? 13}
                        onChange={e => setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), font_size_percentual: +e.target.value } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs text-center focus:outline-none focus:border-[#009c3b]/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Cores por Produto */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Cores por Produto</p>
                    <button
                      type="button"
                      onClick={() => setMeta(p => ({
                        ...p,
                        tank_config: {
                          ...(p.tank_config ?? DEFAULT_TANK),
                          product_colors: [
                            ...(p.tank_config?.product_colors ?? []),
                            { produto: '', color: '#3b82f6' },
                          ],
                        },
                      }))}
                      className="flex items-center gap-1.5 text-xs text-[#009c3b]/70 hover:text-[#009c3b] transition-colors"
                    >
                      <Plus size={12} />
                      Adicionar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(meta.tank_config?.product_colors ?? []).length === 0 && (
                      <p className="text-white/20 text-xs py-2">
                        Nenhuma cor definida — usa as cores automáticas por nível (🔴 crítico / 🟡 alerta / 🟢 normal).
                      </p>
                    )}
                    {(meta.tank_config?.product_colors ?? []).map((pc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nome exato do produto"
                          value={pc.produto}
                          onChange={e => setMeta(p => {
                            const colors = [...(p.tank_config?.product_colors ?? [])]
                            colors[i] = { ...colors[i], produto: e.target.value }
                            return { ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), product_colors: colors } }
                          })}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#009c3b]/50"
                        />
                        <input
                          type="color"
                          value={pc.color}
                          onChange={e => setMeta(p => {
                            const colors = [...(p.tank_config?.product_colors ?? [])]
                            colors[i] = { ...colors[i], color: e.target.value }
                            return { ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), product_colors: colors } }
                          })}
                          className="w-9 h-8 rounded-lg cursor-pointer border border-white/10 bg-transparent p-0.5"
                        />
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: pc.color }}
                        />
                        <button
                          type="button"
                          onClick={() => setMeta(p => {
                            const colors = (p.tank_config?.product_colors ?? []).filter((_, j) => j !== i)
                            return { ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), product_colors: colors } }
                          })}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Layout */}
                <div className="flex items-center gap-3">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Layout</p>
                  <div className="flex gap-1.5">
                    {([1, 2] as const).map(n => (
                      <button key={n} type="button"
                        onClick={() => { setMeta(p => ({ ...p, tank_config: { ...(p.tank_config ?? DEFAULT_TANK), colunas: n } })); setPreviewKey(k => k + 1) }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          (meta.tank_config?.colunas ?? 1) === n
                            ? 'bg-[#009c3b]/80 text-white'
                            : 'bg-white/5 text-white/50 hover:text-white',
                        )}
                      >
                        {n === 1 ? '1 coluna' : '2 colunas'}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setPreviewKey(k => k + 1)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                    <RefreshCw size={12} />Preview
                  </button>
                </div>

                {/* SQL de exemplo */}
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Exemplo de SQL</p>
                  <pre className="text-[11px] text-[#009c3b]/70 font-mono leading-relaxed whitespace-pre-wrap">{`SELECT
  produto,
  volume_atual,
  capacidade_total,
  capacidade_total - volume_atual AS espaco_disponivel
FROM estoque_tanques
WHERE empresa_id IN (:empresas_filtradas)
ORDER BY produto`}</pre>
                </div>
              </div>
            )}

            {/* ── GRÁFICOS CLÁSSICOS — eixos + display ── */}
            {!['report','kpi','heatmap','waterfall','button','tank','multiblock'].includes(type) && (
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

            {/* ── FILTRO DE DATA — sempre visível exceto button e tank ── */}
            {!['button', 'tank'].includes(type) && (
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

                    {/* Tipo de filtro: data ou datetime */}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">
                        Tipo de campo no banco
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['date', 'datetime'] as const).map(ft => {
                          const opt = DATE_FILTER_PRESETS[ft]
                          const active = (dateFlt.filter_type ?? 'date') === ft
                          return (
                            <button
                              key={ft}
                              type="button"
                              onClick={() => setDateFilter({ filter_type: ft })}
                              className={cn(
                                'text-left px-3 py-2.5 rounded-lg border text-xs transition-all',
                                active
                                  ? 'bg-[#009c3b]/15 border-[#009c3b]/40 text-white'
                                  : 'bg-white/3 border-white/8 text-white/40 hover:text-white/60 hover:border-white/15',
                              )}
                            >
                              <p className="font-semibold mb-0.5">{opt.label}</p>
                              <p className="text-[10px] text-white/30 leading-tight">{opt.hint}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

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
                          WHERE {(dateFlt.filter_type ?? 'date') === 'datetime' ? 'criado_em' : 'data'} BETWEEN {dateFlt.param_inicio} AND {dateFlt.param_fim}
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

            {/* ── Refresh / Timeout — sempre visível (exceto button e tank) ── */}
            {!['button', 'tank'].includes(type) && (
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

      {/* Notificações toast */}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default function NovoGraficoPage() {
  return (
    <Suspense>
      <NovoGraficoContent />
    </Suspense>
  )
}
