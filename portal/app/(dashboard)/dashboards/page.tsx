'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar }  from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button }  from '@/components/ui/Button'
import { Badge }   from '@/components/ui/Badge'
import { LiberarModal, type LiberacaoState } from '@/components/ui/LiberarModal'
import { useToast, Toaster }  from '@/components/ui/Toast'
import { Plus, PanelsTopLeft, Edit2, Trash2, Play, BarChart3,
  Globe, Lock, Users, Search } from 'lucide-react'

interface DashItem {
  id: string; nome: string; descricao?: string; cor?: string
  widgets: Array<{ id: string; template_id: string; size: string; order: number }>
  isPublico?: boolean; clienteIds?: string[]; createdAt?: string
}

export default function DashboardsPage() {
  const { toasts, toast, dismiss } = useToast()
  const [dashboards, setDashboards] = useState<DashItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [liberacoes, setLiberacoes] = useState<Record<string, LiberacaoState>>({})
  const [modalDash,  setModalDash]  = useState<DashItem | null>(null)
  const [deletando,  setDeletando]  = useState<string | null>(null)
  const [busca,      setBusca]      = useState('')

  useEffect(() => {
    fetch('/api/dashboards')
      .then(r => r.json())
      .then((data: { dashboards: DashItem[] }) => {
        const list = data.dashboards ?? []
        setDashboards(list)
        // Inicializa liberacoes com dados já carregados dos dashboards
        setLiberacoes(Object.fromEntries(
          list.map(d => [d.id, { is_publico: d.isPublico ?? false, cliente_ids: d.clienteIds ?? [] }])
        ))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function salvarLiberacao(id: string, nova: LiberacaoState) {
    setLiberacoes(prev => ({ ...prev, [id]: nova }))
    // Atualiza o item na lista
    setDashboards(prev => prev.map(d =>
      d.id === id ? { ...d, isPublico: nova.is_publico, clienteIds: nova.cliente_ids } : d
    ))
    setModalDash(null)
  }

  async function deletar(dash: DashItem) {
    if (!confirm(`Excluir dashboard "${dash.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletando(dash.id)
    try {
      const res = await fetch(`/api/dashboards/${dash.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast(d.error ?? 'Erro ao excluir', 'error'); return }
      setDashboards(prev => prev.filter(d => d.id !== dash.id))
      toast('Dashboard excluído', 'success')
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setDeletando(null)
    }
  }

  const dashFiltrados = busca.trim()
    ? dashboards.filter(d =>
        d.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (d.descricao ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : dashboards

  return (
    <div>
      <TopBar
        title="Dashboards"
        subtitle={`${dashboards.length} dashboard(s) cadastrado(s)`}
        actions={
          <Link href="/dashboards/novo">
            <Button size="sm"><Plus size={14} />Novo Dashboard</Button>
          </Link>
        }
      />

      <div className="p-8">
        {/* Busca */}
        <div className="relative mb-5 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar dashboard..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && dashboards.length === 0 && (
          <Card>
            <CardBody>
              <div className="py-12 text-center">
                <PanelsTopLeft size={36} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Nenhum dashboard cadastrado</p>
                <p className="text-white/20 text-xs mt-1">Crie o primeiro dashboard usando o botão acima</p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Lista */}
        {!loading && (
          <div className="grid grid-cols-1 gap-5">
            {dashFiltrados.map(dash => {
              const lib = liberacoes[dash.id] ?? { is_publico: dash.isPublico ?? false, cliente_ids: dash.clienteIds ?? [] }
              return (
                <Card key={dash.id}>
                  <CardBody>
                    <div className="flex items-start gap-5">
                      {/* Ícone colorido */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border"
                        style={{
                          backgroundColor: (dash.cor ?? '#009c3b') + '18',
                          borderColor:     (dash.cor ?? '#009c3b') + '35',
                        }}
                      >
                        <PanelsTopLeft size={22} style={{ color: dash.cor ?? '#009c3b' }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-white font-semibold text-sm">{dash.nome}</h3>
                          <Badge variant="default">{dash.widgets.length} widget(s)</Badge>
                          {lib.is_publico
                            ? <Badge variant="success"><Globe size={9} className="mr-1" />Público</Badge>
                            : lib.cliente_ids.length > 0
                            ? <Badge variant="info"><Users size={9} className="mr-1" />{lib.cliente_ids.length} cliente(s)</Badge>
                            : <Badge variant="default"><Lock size={9} className="mr-1" />Restrito</Badge>
                          }
                        </div>
                        {dash.descricao && (
                          <p className="text-white/40 text-xs mb-3">{dash.descricao}</p>
                        )}

                        {/* Preview das widgets */}
                        {dash.widgets.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {dash.widgets
                              .sort((a, b) => a.order - b.order)
                              .map(w => (
                                <div
                                  key={w.id}
                                  className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-md px-2.5 py-1"
                                >
                                  <BarChart3 size={10} className="text-white/30" />
                                  <span className="text-white/50 text-xs">{w.template_id}</span>
                                  <span className="text-white/20 text-[10px]">
                                    {w.size === '3' ? 'full' : w.size === '2' ? '2/3' : '1/3'}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Link href={`/dashboards/${dash.id}`}>
                          <Button size="sm" variant="primary" className="w-full">
                            <Play size={12} />Ver
                          </Button>
                        </Link>
                        <Link href={`/dashboards/${dash.id}/editar`}>
                          <Button size="sm" variant="secondary" className="w-full">
                            <Edit2 size={12} />Editar
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className={`w-full border ${
                            lib.is_publico
                              ? 'bg-[#009c3b]/10 border-[#009c3b]/30 text-[#009c3b] hover:bg-[#009c3b]/20'
                              : lib.cliente_ids.length
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                          }`}
                          onClick={() => setModalDash(dash)}
                        >
                          {lib.is_publico
                            ? <><Globe size={12} />Público</>
                            : lib.cliente_ids.length
                            ? <><Users size={12} />Liberado</>
                            : <><Lock size={12} />Liberar</>
                          }
                        </Button>
                        <Button
                          size="sm" variant="danger" className="w-full justify-center"
                          loading={deletando === dash.id}
                          onClick={() => deletar(dash)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />

      {modalDash && (
        <LiberarModal
          itemNome={modalDash.nome}
          itemTipo="dashboard"
          liberacao={liberacoes[modalDash.id] ?? { is_publico: false, cliente_ids: [] }}
          apiUrl={`/api/dashboards/liberacao/${modalDash.id}`}
          onSalvar={nova => salvarLiberacao(modalDash.id, nova)}
          onFechar={() => setModalDash(null)}
        />
      )}
    </div>
  )
}
