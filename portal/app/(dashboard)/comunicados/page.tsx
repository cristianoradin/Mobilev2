'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast, Toaster } from '@/components/ui/Toast'
import { Send, Users, Globe, Clock, CheckCircle, Bell, Trash2, Search } from 'lucide-react'

interface Cliente {
  id: string
  nome: string
  cnpj: string
  ativo: boolean
}

interface HistItem {
  id:           string
  title:        string
  body:         string
  route:        string | null
  sent_count:   number
  created_at:   string
  cliente_nome: string | null
  para_todos:   boolean
}

export default function ComunicadosPage() {
  const { toasts, toast, dismiss } = useToast()

  // Form
  const [titulo,     setTitulo]     = useState('')
  const [mensagem,   setMensagem]   = useState('')
  const [clienteId,  setClienteId]  = useState<string>('todos')
  const [enviando,   setEnviando]   = useState(false)

  // Data
  const [clientes,   setClientes]   = useState<Cliente[]>([])
  const [historico,  setHistorico]  = useState<HistItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca,      setBusca]      = useState('')
  const [deletando,  setDeletando]  = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes').then(r => r.json()),
      fetch('/api/push/history').then(r => r.json()),
    ])
      .then(([cData, hData]: [{ clientes: Cliente[] }, { history: HistItem[] }]) => {
        setClientes((cData.clientes ?? []).filter(c => c.ativo))
        setHistorico(hData.history ?? [])
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  async function enviar() {
    if (!titulo.trim()) { toast('Informe o título', 'error'); return }
    if (!mensagem.trim()) { toast('Informe a mensagem', 'error'); return }

    setEnviando(true)
    try {
      const cliente = clienteId !== 'todos'
        ? clientes.find(c => c.id === clienteId)
        : null

      const res = await fetch('/api/push/broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id:   cliente?.id ?? null,
          cliente_nome: cliente?.nome ?? null,
          title:        titulo.trim(),
          body:         mensagem.trim(),
          route:        '/config/notificacoes',
        }),
      })

      const data = await res.json() as { ok?: boolean; sent?: number; total?: number; error?: string }

      if (!res.ok || !data.ok) {
        toast(data.error ?? 'Erro ao enviar comunicado', 'error')
        return
      }

      toast(
        data.total === 0
          ? 'Comunicado salvo (nenhum dispositivo registrado)'
          : `Comunicado enviado para ${data.sent} de ${data.total} dispositivo(s)`,
        data.sent && data.sent > 0 ? 'success' : 'warning'
      )

      // Limpa o form
      setTitulo('')
      setMensagem('')
      setClienteId('todos')

      // Recarrega histórico
      fetch('/api/push/history')
        .then(r => r.json())
        .then((d: { history: HistItem[] }) => setHistorico(d.history ?? []))
        .catch(() => {})
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setEnviando(false)
    }
  }

  async function deletarComunicado(id: string) {
    if (!confirm('Excluir este comunicado do histórico?')) return
    setDeletando(id)
    try {
      const res = await fetch('/api/push/history', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro ao excluir', 'error'); return }
      setHistorico(prev => prev.filter(h => h.id !== id))
      toast('Comunicado removido', 'success')
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setDeletando(null)
    }
  }

  const comunicadosFiltrados = busca.trim()
    ? historico.filter(h =>
        h.title.toLowerCase().includes(busca.toLowerCase()) ||
        h.body.toLowerCase().includes(busca.toLowerCase()) ||
        (h.cliente_nome ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : historico

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <TopBar
        title="Comunicados"
        subtitle="Envie notificações push para clientes mobile"
      />

      <div className="p-8 grid grid-cols-2 gap-6 items-start">
        {/* ── Formulário de envio ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
                  <Bell size={15} className="text-[#009c3b]" />
                </div>
                <p className="text-white font-semibold text-sm">Novo Comunicado</p>
              </div>

              {/* Destinatário */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Destinatário</label>
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all"
                >
                  <option value="todos">🌐 Todos os clientes</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Título */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Título da notificação</label>
                <input
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Atualização importante"
                  maxLength={80}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
                />
                <p className="text-white/25 text-[10px] mt-1 text-right">{titulo.length}/80</p>
              </div>

              {/* Mensagem */}
              <div className="mb-5">
                <label className="block text-white/50 text-xs mb-1.5">Mensagem</label>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder="Ex: Nova funcionalidade disponível no app..."
                  maxLength={200}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all resize-none"
                />
                <p className="text-white/25 text-[10px] mt-1 text-right">{mensagem.length}/200</p>
              </div>

              {/* Preview */}
              {(titulo || mensagem) && (
                <div className="bg-black/30 border border-white/8 rounded-xl p-4 mb-5">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Preview da notificação</p>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#009c3b] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Bell size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{titulo || 'Título...'}</p>
                      <p className="text-white/60 text-xs mt-0.5">{mensagem || 'Mensagem...'}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full justify-center"
                loading={enviando}
                disabled={!titulo.trim() || !mensagem.trim()}
                onClick={enviar}
              >
                <Send size={14} />
                {clienteId === 'todos' ? 'Enviar para Todos' : 'Enviar para Cliente'}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ── Histórico ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
              Histórico de Comunicados
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar comunicado..."
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 w-48 transition-all"
              />
            </div>
          </div>

          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
          ) : comunicadosFiltrados.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-8 text-center">
                  <Bell size={28} className="text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">
                    {busca ? 'Nenhum resultado encontrado' : 'Nenhum comunicado enviado ainda'}
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {comunicadosFiltrados.map(h => (
                <Card key={h.id}>
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        h.para_todos
                          ? 'bg-[#009c3b]/10 border-[#009c3b]/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}>
                        {h.para_todos
                          ? <Globe size={14} className="text-[#009c3b]" />
                          : <Users size={14} className="text-blue-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-white text-sm font-semibold">{h.title}</p>
                          {h.para_todos
                            ? <Badge variant="success">Todos</Badge>
                            : <Badge variant="info">{h.cliente_nome ?? 'Cliente'}</Badge>
                          }
                        </div>
                        <p className="text-white/50 text-xs mb-2">{h.body}</p>
                        <div className="flex items-center gap-3 text-[10px] text-white/30">
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {formatDate(h.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle size={9} />
                            {h.sent_count} entregue(s)
                          </span>
                        </div>
                      </div>

                      {/* Deletar */}
                      <button
                        onClick={() => deletarComunicado(h.id)}
                        disabled={deletando === h.id}
                        title="Excluir do histórico"
                        className="flex-shrink-0 p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
