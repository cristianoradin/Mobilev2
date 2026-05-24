'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { useToast, Toaster } from '@/components/ui/Toast'
import {
  Plus, Save, Search, BarChart3, LineChart, PieChart, Gauge, TrendingUp,
  TableProperties, Flame, Layers, MousePointerClick, ChevronUp, ChevronDown,
  X, GripVertical, Check, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ChartMetadata, DashboardWidget, WidgetSize } from '@/lib/types'

// ── Mapa de ícones e estilos por tipo ─────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  line: LineChart, bar: BarChart3, pie: PieChart, gauge: Gauge,
  area: TrendingUp, report: TableProperties, kpi: Flame,
  heatmap: Layers, waterfall: BarChart3, button: MousePointerClick,
}
const TYPE_COLOR: Record<string, string> = {
  report: 'text-blue-400', kpi: 'text-amber-400', heatmap: 'text-purple-400',
  waterfall: 'text-cyan-400', button: 'text-rose-400',
}
const TYPE_LABEL: Record<string, string> = {
  report: 'Relatório', kpi: 'KPI Card', heatmap: 'Heatmap',
  waterfall: 'Waterfall', button: 'Botões',
}
const CAT_BADGE: Record<string, 'success'|'info'|'warning'|'purple'|'default'> = {
  vendas: 'success', estoque: 'info', financeiro: 'warning', operacional: 'purple', geral: 'default',
}

// ── Mock templates (mesmos de graficos/page.tsx) ──────────────────────────────
const ALL_TEMPLATES: ChartMetadata[] = [
  {
    id: 'tmpl-001', nome: 'Vendas por Hora', descricao: 'Volume de vendas agrupado por hora do dia',
    categoria: 'vendas', chart_type: 'area', is_publico: true,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'hora', label: 'Hora' }, y: [] }, display: { height: 'md', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'operador' }, created_at: '2026-05-10T10:00:00Z',
  },
  {
    id: 'tmpl-002', nome: 'Nível dos Tanques', descricao: 'Percentual atual de combustível em cada tanque',
    categoria: 'estoque', chart_type: 'gauge', is_publico: true,
    query: { sql: '', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'tanque', label: 'Tanque' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' }, created_at: '2026-05-12T14:00:00Z',
  },
  {
    id: 'tmpl-003', nome: 'Mix de Combustível', descricao: 'Participação % de cada combustível nas vendas',
    categoria: 'vendas', chart_type: 'pie', is_publico: false,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'tipo', label: 'Tipo' }, y: [] }, display: { height: 'sm', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'gerente' }, created_at: '2026-05-15T09:00:00Z',
  },
  {
    id: 'tmpl-004', nome: 'Faturamento Mensal', descricao: 'Evolução do faturamento nos últimos 30 dias',
    categoria: 'financeiro', chart_type: 'bar', is_publico: false,
    query: { sql: '', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'data', label: 'Data' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'dono' }, created_at: '2026-05-18T16:00:00Z',
  },
  {
    id: 'tmpl-005', nome: 'Relatório de Vendas por Produto', descricao: 'Tabela detalhada de vendas agrupadas por combustível',
    categoria: 'vendas', chart_type: 'report', is_publico: true,
    query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'produto', label: 'Produto' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' }, created_at: '2026-05-20T11:00:00Z',
  },
  {
    id: 'tmpl-006', nome: 'KPI — Indicadores do Dia', descricao: '4 métricas-chave em tempo real',
    categoria: 'vendas', chart_type: 'kpi', is_publico: true,
    query: { sql: '', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'label', label: 'Métrica' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' }, created_at: '2026-05-21T08:00:00Z',
  },
  {
    id: 'tmpl-007', nome: 'Heatmap — Movimento por Hora/Dia', descricao: 'Intensidade de vendas por hora × dia da semana',
    categoria: 'operacional', chart_type: 'heatmap', is_publico: false,
    query: { sql: '', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'hora', label: 'Horário' }, y: [] }, display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'gerente' }, created_at: '2026-05-21T10:00:00Z',
  },
  {
    id: 'tmpl-008', nome: 'Waterfall — Demonstrativo de Resultado', descricao: 'Composição do resultado do período',
    categoria: 'financeiro', chart_type: 'waterfall', is_publico: false,
    query: { sql: '', refresh_seconds: 86400, timeout_seconds: 60 },
    axes: { x: { field: 'componente', label: 'Componente' }, y: [] }, display: { height: 'lg', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'dono' }, created_at: '2026-05-21T12:00:00Z',
  },
  {
    id: 'tmpl-009', nome: 'Botões — Ações Rápidas', descricao: 'Atalhos de tela: estoque, troca de preço e autorizações',
    categoria: 'operacional', chart_type: 'button', is_publico: true,
    query: { sql: '', refresh_seconds: 0, timeout_seconds: 0 },
    axes: { x: { field: '', label: '' }, y: [] }, display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' }, created_at: '2026-05-21T14:00:00Z',
  },
]

// ── Cores disponíveis para o dashboard ────────────────────────────────────────
const COLORS = [
  '#009c3b','#3b82f6','#f97316','#8b5cf6','#ec4899','#14b8a6','#eab308','#ef4444',
]

// ── Opções de tamanho do widget ───────────────────────────────────────────────
const SIZE_OPTS: { value: WidgetSize; label: string; desc: string }[] = [
  { value: '1', label: '1/3', desc: 'Compacto'    },
  { value: '2', label: '2/3', desc: 'Médio'       },
  { value: '3', label: 'Full', desc: 'Largura total' },
]

// ── Sub-componente: card de template na biblioteca ────────────────────────────
function TemplateCard({
  tmpl,
  added,
  onAdd,
}: { tmpl: ChartMetadata; added: boolean; onAdd: () => void }) {
  const Icon  = ICON_MAP[tmpl.chart_type] ?? BarChart3
  const tColor = TYPE_COLOR[tmpl.chart_type]
  const tLabel = TYPE_LABEL[tmpl.chart_type]

  return (
    <button
      onClick={onAdd}
      disabled={added}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all duration-150 group',
        added
          ? 'bg-[#009c3b]/8 border-[#009c3b]/30 cursor-default'
          : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15 cursor-pointer',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors',
          added ? 'bg-[#009c3b]/20 border-[#009c3b]/30' : 'bg-white/5 border-white/10',
        )}>
          {added
            ? <Check size={14} className="text-[#009c3b]" />
            : <Icon size={14} className={tColor ?? 'text-white/50'} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{tmpl.nome}</p>
          <p className="text-white/35 text-[10px] truncate mt-0.5">{tmpl.descricao}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant={CAT_BADGE[tmpl.categoria] ?? 'default'} className="text-[9px] px-1.5 py-0">{tmpl.categoria}</Badge>
            {tLabel && <Badge variant="default" className="text-[9px] px-1.5 py-0">{tLabel}</Badge>}
          </div>
        </div>
        {!added && (
          <Plus size={13} className="text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0 mt-1" />
        )}
      </div>
    </button>
  )
}

// ── Sub-componente: widget na lista de selecionados ───────────────────────────
function SelectedWidget({
  widget,
  tmpl,
  index,
  total,
  onMove,
  onRemove,
  onSize,
}: {
  widget:   DashboardWidget
  tmpl:     ChartMetadata | undefined
  index:    number
  total:    number
  onMove:   (dir: 'up' | 'down') => void
  onRemove: () => void
  onSize:   (s: WidgetSize) => void
}) {
  const Icon  = tmpl ? (ICON_MAP[tmpl.chart_type] ?? BarChart3) : BarChart3
  const tColor = tmpl ? TYPE_COLOR[tmpl.chart_type] : undefined

  return (
    <div className="flex items-center gap-2 bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 group">
      {/* Grip */}
      <GripVertical size={14} className="text-white/20 flex-shrink-0" />

      {/* Ícone */}
      <div className="w-7 h-7 bg-white/6 border border-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={12} className={tColor ?? 'text-white/50'} />
      </div>

      {/* Nome */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{tmpl?.nome ?? widget.template_id}</p>
        <p className="text-white/30 text-[10px]">{tmpl?.chart_type ?? ''}</p>
      </div>

      {/* Seletor de tamanho */}
      <div className="flex gap-0.5 flex-shrink-0">
        {SIZE_OPTS.map(s => (
          <button
            key={s.value}
            onClick={() => onSize(s.value)}
            title={s.desc}
            className={cn(
              'px-1.5 py-1 rounded text-[10px] font-semibold transition-all',
              widget.size === s.value
                ? 'bg-[#009c3b] text-white'
                : 'text-white/30 hover:text-white hover:bg-white/8',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Reordenar */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          onClick={() => onMove('up')}
          disabled={index === 0}
          className="p-0.5 rounded hover:bg-white/8 text-white/25 hover:text-white disabled:opacity-20 transition-all"
        >
          <ChevronUp size={11} />
        </button>
        <button
          onClick={() => onMove('down')}
          disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-white/8 text-white/25 hover:text-white disabled:opacity-20 transition-all"
        >
          <ChevronDown size={11} />
        </button>
      </div>

      {/* Remover */}
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-red-500/15 text-white/20 hover:text-red-400 transition-all flex-shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ── Preview do grid ───────────────────────────────────────────────────────────
function GridPreview({ widgets }: { widgets: DashboardWidget[] }) {
  if (widgets.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
        <p className="text-white/20 text-xs">Adicione widgets para ver o layout</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {widgets.map(w => {
        const tmpl = ALL_TEMPLATES.find(t => t.id === w.template_id)
        const Icon  = tmpl ? (ICON_MAP[tmpl.chart_type] ?? BarChart3) : BarChart3
        const span  = w.size === '3' ? 'col-span-3' : w.size === '2' ? 'col-span-2' : 'col-span-1'
        const h     = tmpl?.display.height === 'lg' ? 'h-16' : tmpl?.display.height === 'md' ? 'h-12' : 'h-9'
        return (
          <div
            key={w.id}
            className={cn(
              span, h,
              'bg-white/4 border border-white/8 rounded-lg flex items-center gap-2 px-3',
            )}
          >
            <Icon size={11} className="text-white/30 flex-shrink-0" />
            <span className="text-white/40 text-[10px] truncate">{tmpl?.nome ?? w.template_id}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function NovoDashboardPage() {
  const router = useRouter()
  const { toasts, toast, dismiss } = useToast()
  const [nome, setNome]         = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor]           = useState(COLORS[0])
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState<string>('todos')
  const [widgets, setWidgets]   = useState<DashboardWidget[]>([])
  const [saving, setSaving]     = useState(false)

  // Templates filtrados
  const categorias = ['todos', ...Array.from(new Set(ALL_TEMPLATES.map(t => t.categoria)))]
  const filtered = useMemo(() =>
    ALL_TEMPLATES.filter(t => {
      const matchSearch = t.nome.toLowerCase().includes(search.toLowerCase()) ||
                         (t.descricao ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = catFilter === 'todos' || t.categoria === catFilter
      return matchSearch && matchCat
    }),
    [search, catFilter]
  )

  const addedIds = new Set(widgets.map(w => w.template_id))

  function addWidget(tmpl: ChartMetadata) {
    if (addedIds.has(tmpl.id)) return
    const defaultSize: WidgetSize = tmpl.chart_type === 'kpi' ? '3'
      : tmpl.chart_type === 'report' || tmpl.chart_type === 'heatmap' || tmpl.chart_type === 'waterfall' ? '3'
      : '1'
    setWidgets(prev => [...prev, {
      id:          crypto.randomUUID(),
      template_id: tmpl.id,
      size:        defaultSize,
      order:       prev.length,
    }])
  }

  function removeWidget(id: string) {
    setWidgets(prev => prev.filter(w => w.id !== id).map((w, i) => ({ ...w, order: i })))
  }

  function moveWidget(id: string, dir: 'up' | 'down') {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next.map((w, i) => ({ ...w, order: i }))
    })
  }

  function setWidgetSize(id: string, size: WidgetSize) {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, size } : w))
  }

  async function handleSave() {
    if (!nome.trim()) { toast('Nome é obrigatório', 'error'); return }
    if (widgets.length === 0) { toast('Adicione pelo menos um widget', 'warning'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim() || null, cor, widgets }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast(d.error ?? 'Erro ao salvar dashboard', 'error')
        return
      }
      toast('Dashboard criado com sucesso!', 'success')
      setTimeout(() => router.push('/dashboards'), 1200)
    } catch {
      toast('Erro de conexão ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Novo Dashboard"
        subtitle="Configure o nome, widgets e layout"
        actions={
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!nome.trim() || widgets.length === 0}
          >
            <Save size={14} />Salvar Dashboard
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Painel esquerdo: biblioteca de templates ─────────────────────── */}
        <div className="w-80 border-r border-white/8 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-white/8">
            <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-3">
              Biblioteca de Templates
            </p>
            {/* Search */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar template..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            {/* Filtro categoria */}
            <div className="flex gap-1 flex-wrap">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all',
                    catFilter === cat
                      ? 'bg-[#009c3b]/20 text-[#009c3b] border border-[#009c3b]/30'
                      : 'text-white/35 hover:text-white border border-transparent hover:border-white/15',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.map(tmpl => (
              <TemplateCard
                key={tmpl.id}
                tmpl={tmpl}
                added={addedIds.has(tmpl.id)}
                onAdd={() => addWidget(tmpl)}
              />
            ))}
          </div>
        </div>

        {/* ── Painel direito: configuração do dashboard ──────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dados básicos */}
          <Card>
            <CardBody className="space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                <SlidersHorizontal size={13} />Configuração
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nome do Dashboard"
                  placeholder="Ex: Operacional do Dia"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
                <Input
                  label="Descrição (opcional)"
                  placeholder="Breve descrição do propósito"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                />
              </div>
              {/* Cor */}
              <div>
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Cor de destaque</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: cor === c ? '#fff' : 'transparent',
                        boxShadow: cor === c ? `0 0 0 1px ${c}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Preview do layout */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">
                  Preview do Layout
                </p>
                <span className="text-white/30 text-xs">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
              </div>
              <GridPreview widgets={widgets} />
            </CardBody>
          </Card>

          {/* Widgets selecionados */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">
                  Widgets Selecionados
                </p>
                <p className="text-white/25 text-[10px]">
                  Clique nos templates à esquerda para adicionar
                </p>
              </div>

              {widgets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/20 text-sm">Nenhum widget adicionado</p>
                  <p className="text-white/15 text-xs mt-1">Selecione templates na biblioteca ao lado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {widgets
                    .sort((a, b) => a.order - b.order)
                    .map((w, i) => (
                      <SelectedWidget
                        key={w.id}
                        widget={w}
                        tmpl={ALL_TEMPLATES.find(t => t.id === w.template_id)}
                        index={i}
                        total={widgets.length}
                        onMove={dir => moveWidget(w.id, dir)}
                        onRemove={() => removeWidget(w.id)}
                        onSize={s => setWidgetSize(w.id, s)}
                      />
                    ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Dica de tamanhos */}
          <div className="flex gap-3 text-[10px] text-white/25">
            <span><span className="text-white/40 font-semibold">1/3</span> — Compacto (gauge, pie, botões)</span>
            <span>·</span>
            <span><span className="text-white/40 font-semibold">2/3</span> — Médio (área, bar, line)</span>
            <span>·</span>
            <span><span className="text-white/40 font-semibold">Full</span> — Largura total (KPI, relatório, heatmap)</span>
          </div>
        </div>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
