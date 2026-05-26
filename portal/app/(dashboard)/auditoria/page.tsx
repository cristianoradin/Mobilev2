'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Search, Shield, Key, BarChart3, User, Database, AlertTriangle,
  LogIn, LogOut, Trash2, PenLine, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface AuditEvent {
  id:           number
  acao:         string
  recurso:      string | null
  ip_address:   string | null
  status:       'ok' | 'warn' | 'error'
  created_at:   string
  cliente_nome: string | null
  admin_email:  string | null
  admin_nome:   string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de ações → ícone + label
// ─────────────────────────────────────────────────────────────────────────────
const ACAO_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }> = {
  'auth.login':          { icon: LogIn,        label: 'Login'               },
  'auth.login_failed':   { icon: Shield,        label: 'Login falhou'        },
  'auth.logout':         { icon: LogOut,        label: 'Logout'              },
  'token.generate':      { icon: Key,           label: 'Token gerado'        },
  'grafico.create':      { icon: BarChart3,      label: 'Template criado'     },
  'grafico.update':      { icon: PenLine,        label: 'Template editado'    },
  'grafico.delete':      { icon: Trash2,         label: 'Template excluído'   },
  'query.execute':       { icon: Database,       label: 'Query executada'     },
  'query.blocked':       { icon: AlertTriangle,  label: 'Query bloqueada'     },
  'cliente.create':      { icon: User,           label: 'Cliente criado'      },
  'licenca.create':      { icon: BarChart3,      label: 'Licença criada'      },
  'price.update':        { icon: BarChart3,      label: 'Preço atualizado'    },
  'auth.discount_approve': { icon: User,         label: 'Desconto aprovado'   },
}

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger'> = {
  ok: 'success', warn: 'warning', error: 'danger',
}
const STATUS_LABEL: Record<string, string> = {
  ok: 'OK', warn: 'Aviso', error: 'Bloqueado',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const LIMIT = 50

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────
export default function AuditoriaPage() {
  const [events,       setEvents]       = useState<AuditEvent[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [q,            setQ]            = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [page,         setPage]         = useState(0)
  const [debouncedQ,   setDebouncedQ]   = useState('')

  // Debounce do campo de busca
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [q])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q:      debouncedQ,
        status: filterStatus === 'todos' ? '' : filterStatus,
        page:   String(page),
        limit:  String(LIMIT),
      })
      const res = await fetch(`/api/auditoria?${params}`)
      if (!res.ok) throw new Error('Falha ao carregar')
      const data = await res.json()
      setEvents(data.events ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, filterStatus, page])

  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div>
      <TopBar
        title="Auditoria"
        subtitle={loading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} evento${total !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => void fetchEvents()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-white/5 text-white/50 hover:text-white hover:bg-white/8 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      <div className="p-8 space-y-5">
        {/* ── Filtros ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar ação, recurso, IP, admin..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/4 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#009c3b]/50"
            />
          </div>
          <div className="flex gap-1.5">
            {(['todos', 'ok', 'warn', 'error'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(0) }}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  filterStatus === s ? 'bg-[#009c3b] text-white' : 'bg-white/5 text-white/40 hover:text-white',
                )}
              >
                {s === 'todos' ? 'Todos' : s === 'ok' ? 'OK' : s === 'warn' ? 'Avisos' : 'Erros'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tabela ── */}
        <Card>
          <div className="divide-y divide-white/5">
            {loading && events.length === 0 && (
              <div className="p-8 text-center text-white/20 text-sm">Carregando eventos…</div>
            )}
            {!loading && events.length === 0 && (
              <div className="p-8 text-center text-white/20 text-sm">
                {total === 0 && !debouncedQ && filterStatus === 'todos'
                  ? 'Nenhum evento registrado ainda. As ações do portal aparecerão aqui.'
                  : 'Nenhum evento encontrado para os filtros selecionados.'}
              </div>
            )}
            {events.map(event => {
              const meta = ACAO_META[event.acao] ?? { icon: Shield, label: event.acao }
              const Icon = meta.icon
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors"
                  title={fullDate(event.created_at)}
                >
                  {/* Ícone */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    event.status === 'error' ? 'bg-red-500/10'
                    : event.status === 'warn' ? 'bg-yellow-500/10'
                    : 'bg-white/5',
                  )}>
                    <Icon size={14} className={cn(
                      event.status === 'error' ? 'text-red-400'
                      : event.status === 'warn' ? 'text-yellow-400'
                      : 'text-white/40',
                    )} />
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-white/80 text-sm font-medium font-mono">{event.acao}</span>
                      <span className="text-white/30 text-xs">·</span>
                      <span className="text-white/50 text-xs">{meta.label}</span>
                      <Badge variant={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-white/30 text-xs flex-wrap">
                      {event.cliente_nome && (
                        <>
                          <span>{event.cliente_nome}</span>
                          <span>·</span>
                        </>
                      )}
                      {event.admin_email && (
                        <>
                          <span className="text-white/40">{event.admin_nome ?? event.admin_email}</span>
                          <span>·</span>
                        </>
                      )}
                      {event.recurso && (
                        <span className="font-mono text-white/40 truncate max-w-[220px]">{event.recurso}</span>
                      )}
                    </div>
                  </div>

                  {/* IP + tempo */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    {event.ip_address && (
                      <span className="text-white/25 text-xs font-mono">{event.ip_address}</span>
                    )}
                    <span className="text-white/20 text-xs w-16 text-right">
                      {relTime(event.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── Paginação ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-white/30">
            <span>
              {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} de {total.toLocaleString('pt-BR')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2">pág. {page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
