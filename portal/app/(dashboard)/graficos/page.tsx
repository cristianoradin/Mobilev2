'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LiberarModal, type LiberacaoState } from '@/components/ui/LiberarModal'
import { useToast, Toaster } from '@/components/ui/Toast'
import { Plus, BarChart3, LineChart, PieChart, Gauge, TrendingUp, Edit2, Trash2, Copy,
  TableProperties, Flame, Layers, MousePointerClick, Globe, Lock, Users, Fuel, Search } from 'lucide-react'
import type { ChartMetadata } from '@/lib/types'
import { SYSTEM_TEMPLATES } from '@/lib/templates'

const ICON_MAP: Record<string, React.ElementType> = {
  line:      LineChart,
  bar:       BarChart3,
  pie:       PieChart,
  gauge:     Gauge,
  area:      TrendingUp,
  report:    TableProperties,
  kpi:       Flame,
  heatmap:   Layers,
  waterfall: BarChart3,
  button:    MousePointerClick,
  tank:      Fuel,
}

// Cor de destaque por tipo (bg/text)
const TYPE_STYLE: Record<string, { bg: string; text: string; badge: 'success'|'info'|'warning'|'purple'|'danger'|'default' }> = {
  report:    { bg: 'bg-blue-500/10    border-blue-500/20',    text: 'text-blue-400',   badge: 'info'    },
  kpi:       { bg: 'bg-amber-500/10   border-amber-500/20',   text: 'text-amber-400',  badge: 'warning' },
  heatmap:   { bg: 'bg-purple-500/10  border-purple-500/20',  text: 'text-purple-400', badge: 'purple'  },
  waterfall: { bg: 'bg-cyan-500/10    border-cyan-500/20',    text: 'text-cyan-400',   badge: 'info'    },
  button:    { bg: 'bg-rose-500/10    border-rose-500/20',    text: 'text-rose-400',   badge: 'danger'  },
  tank:      { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', badge: 'success' },
}

const TYPE_LABEL: Partial<Record<string, string>> = {
  report:    'Relatório',
  kpi:       'KPI Card',
  heatmap:   'Heatmap',
  waterfall: 'Waterfall',
  button:    'Botões',
  tank:      'Tanques',
}
const COLOR_CAT: Record<string, 'success' | 'info' | 'warning' | 'purple' | 'default'> = {
  vendas: 'success', estoque: 'info', financeiro: 'warning', operacional: 'purple', geral: 'default',
}


export default function GraficosPage() {
  const router = useRouter()
  const { toasts, toast, dismiss } = useToast()
  const [liberacoes, setLiberacoes] = useState<Record<string, LiberacaoState>>(() =>
    Object.fromEntries(SYSTEM_TEMPLATES.map(t => [t.id, { is_publico: false, cliente_ids: [] }]))
  )
  const [modalItem, setModalItem] = useState<ChartMetadata | null>(null)
  const [customGraficos, setCustomGraficos] = useState<ChartMetadata[]>([])
  const [duplicando, setDuplicando] = useState<string | null>(null)
  const [deletando, setDeletando]   = useState<string | null>(null)
  const [busca,     setBusca]       = useState('')

  const allGraficos = [...SYSTEM_TEMPLATES, ...customGraficos]

  const templatesFiltrados = busca.trim()
    ? allGraficos.filter(t =>
        t.nome.toLowerCase().includes(busca.toLowerCase()) ||
        t.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        t.chart_type.toLowerCase().includes(busca.toLowerCase()) ||
        (t.descricao ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : allGraficos

  async function duplicar(tmpl: ChartMetadata) {
    setDuplicando(tmpl.id)
    try {
      const res  = await fetch(`/api/graficos/${tmpl.id}`)
      const data = await res.json() as { template?: ChartMetadata }
      if (!data.template) { toast('Template não encontrado', 'error'); return }
      router.push(`/graficos/novo?from=${tmpl.id}`)
    } catch {
      toast('Erro ao duplicar template', 'error')
    } finally {
      setDuplicando(null)
    }
  }

  // Carrega estado de liberação do banco ao montar
  useEffect(() => {
    // Liberações de templates do sistema
    fetch('/api/graficos/liberacoes')
      .then(r => r.json())
      .then((data: { liberacoes: Record<string, { is_publico: boolean; cliente_ids: string[] }> }) => {
        if (data.liberacoes) {
          setLiberacoes(prev => {
            const next = { ...prev }
            for (const [key, val] of Object.entries(data.liberacoes)) {
              next[key] = { is_publico: val.is_publico, cliente_ids: val.cliente_ids }
            }
            return next
          })
        }
      })
      .catch(() => {})

    // Graficos customizados criados pelo admin (armazenados no DB)
    fetch('/api/graficos')
      .then(r => r.json())
      .then((data: { graficos: ChartMetadata[] }) => {
        const list = data.graficos ?? []
        setCustomGraficos(list)
        // Inicializa liberações a partir dos próprios dados do DB
        setLiberacoes(prev => ({
          ...prev,
          ...Object.fromEntries(
            list.map(g => [g.id, { is_publico: g.is_publico, cliente_ids: g.cliente_ids ?? [] }])
          ),
        }))
      })
      .catch(() => {})
  }, [])

  async function deletar(tmpl: ChartMetadata) {
    if (tmpl.id.startsWith('tmpl-')) {
      toast('Templates do sistema não podem ser excluídos', 'warning'); return
    }
    if (!confirm(`Excluir template "${tmpl.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletando(tmpl.id)
    try {
      const res = await fetch(`/api/graficos/${tmpl.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast(d.error ?? 'Erro ao excluir', 'error'); return }
      toast('Template excluído', 'success')
      setCustomGraficos(prev => prev.filter(g => g.id !== tmpl.id))
      setLiberacoes(prev => { const next = { ...prev }; delete next[tmpl.id]; return next })
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setDeletando(null)
    }
  }

  function salvarLiberacao(id: string, nova: LiberacaoState) {
    setLiberacoes(prev => ({ ...prev, [id]: nova }))
    setModalItem(null)
  }

  function badgeLiberacao(id: string) {
    const l = liberacoes[id]
    if (!l) return null
    if (l.is_publico) return <Badge variant="success"><Globe size={9} className="mr-1" />Público</Badge>
    if (l.cliente_ids.length > 0) return <Badge variant="info"><Users size={9} className="mr-1" />{l.cliente_ids.length} cliente(s)</Badge>
    return <Badge variant="default"><Lock size={9} className="mr-1" />Restrito</Badge>
  }

  return (
    <div>
      <TopBar
        title="Templates de Gráficos"
        subtitle={`${allGraficos.length} template(s)`}
        actions={
          <Link href="/graficos/novo">
            <Button size="sm"><Plus size={14} />Novo Template</Button>
          </Link>
        }
      />

      <div className="p-8">
        {/* Busca */}
        <div className="relative mb-5 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, tipo, categoria..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          {templatesFiltrados.map(tmpl => {
            const Icon    = ICON_MAP[tmpl.chart_type] ?? BarChart3
            const tStyle  = TYPE_STYLE[tmpl.chart_type]
            const tLabel  = TYPE_LABEL[tmpl.chart_type]
            return (
              <Card key={tmpl.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 border rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tStyle ? tStyle.bg : 'bg-white/5 border-white/10'
                    }`}>
                      <Icon size={20} className={tStyle ? tStyle.text : 'text-white/60'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-white font-semibold text-sm">{tmpl.nome}</p>
                        <Badge variant={COLOR_CAT[tmpl.categoria]}>{tmpl.categoria}</Badge>
                        {tLabel && <Badge variant={tStyle?.badge ?? 'default'}>{tLabel}</Badge>}
                        {badgeLiberacao(tmpl.id)}
                      </div>
                      <p className="text-white/40 text-xs mb-3">{tmpl.descricao}</p>

                      <div className="flex items-center gap-3 text-xs text-white/30 mb-4">
                        {tmpl.chart_type === 'report'
                          ? <span>Colunas: <span className="text-white/60">{tmpl.report_config?.columns.length ?? 0}</span></span>
                          : tmpl.chart_type === 'kpi'
                            ? <span>Métricas: <span className="text-white/60">{tmpl.kpi_config?.metrics.length ?? 0}</span></span>
                            : tmpl.chart_type === 'button'
                              ? <span>Botões: <span className="text-white/60">{tmpl.button_config?.buttons.length ?? 0}</span></span>
                              : <span>Tipo: <span className="text-white/60 capitalize">{tmpl.chart_type}</span></span>
                        }
                        {tmpl.chart_type !== 'button' && (
                          <span>Refresh: <span className="text-white/60">{tmpl.query.refresh_seconds}s</span></span>
                        )}
                        <span>Role: <span className="text-white/60">{tmpl.permissions.min_role}</span></span>
                      </div>

                      {/* SQL preview */}
                      <div className="bg-black/30 rounded-lg p-3 mb-4">
                        <code className="text-green-400/70 text-[10px] font-mono line-clamp-2 leading-relaxed">
                          {tmpl.query.sql}
                        </code>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary" size="sm"
                          onClick={() => router.push(`/graficos/novo?edit=${tmpl.id}`)}
                        >
                          <Edit2 size={12} />Editar
                        </Button>
                        <Button
                          variant="secondary" size="sm"
                          loading={duplicando === tmpl.id}
                          onClick={() => duplicar(tmpl)}
                        >
                          <Copy size={12} />Duplicar
                        </Button>
                        <Button
                          size="sm"
                          className={`ml-auto border ${
                            liberacoes[tmpl.id]?.is_publico
                              ? 'bg-[#009c3b]/10 border-[#009c3b]/30 text-[#009c3b] hover:bg-[#009c3b]/20'
                              : liberacoes[tmpl.id]?.cliente_ids?.length
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                          }`}
                          onClick={() => setModalItem(tmpl)}
                        >
                          {liberacoes[tmpl.id]?.is_publico
                            ? <><Globe size={12} />Público</>
                            : liberacoes[tmpl.id]?.cliente_ids?.length
                            ? <><Users size={12} />Liberado</>
                            : <><Lock size={12} />Liberar</>
                          }
                        </Button>
                        <Button
                          variant="danger" size="sm"
                          loading={deletando === tmpl.id}
                          disabled={tmpl.id.startsWith('tmpl-')}
                          onClick={() => deletar(tmpl)}
                          title={tmpl.id.startsWith('tmpl-') ? 'Templates do sistema não podem ser excluídos' : 'Excluir template'}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Toast */}
      <Toaster toasts={toasts} onDismiss={dismiss} />

      {/* Modal de liberação */}
      {modalItem && (
        <LiberarModal
          itemNome={modalItem.nome}
          itemTipo="template"
          liberacao={liberacoes[modalItem.id] ?? { is_publico: false, cliente_ids: [] }}
          apiUrl={`/api/graficos/liberacao/${modalItem.id}`}
          onSalvar={nova => salvarLiberacao(modalItem.id, nova)}
          onFechar={() => setModalItem(null)}
        />
      )}
    </div>
  )
}
