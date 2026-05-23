'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Search, Shield, Key, BarChart3, User, Database, AlertTriangle } from 'lucide-react'

interface AuditMock {
  id: number
  cliente_nome: string
  usuario: string
  acao: string
  recurso: string
  ip_address: string
  status: 'ok' | 'warn' | 'error'
  created_at: string
}

const MOCK_AUDIT: AuditMock[] = [
  { id: 1, cliente_nome: 'Rede Petro Sul S.A.', usuario: 'ti@petrosul.com.br', acao: 'token.generate', recurso: 'agent_token', ip_address: '201.55.12.88', status: 'ok', created_at: '2026-05-22T09:41:00Z' },
  { id: 2, cliente_nome: 'Posto Central Ltda', usuario: 'contato@postocentral.com.br', acao: 'query.execute', recurso: 'vendas', ip_address: '192.168.1.10', status: 'ok', created_at: '2026-05-22T09:38:00Z' },
  { id: 3, cliente_nome: 'Posto Central Ltda', usuario: 'contato@postocentral.com.br', acao: 'query.blocked', recurso: 'DELETE FROM vendas', ip_address: '192.168.1.10', status: 'error', created_at: '2026-05-22T09:35:00Z' },
  { id: 4, cliente_nome: 'Rede Petro Sul S.A.', usuario: 'gerente@petrosul.com.br', acao: 'price.update', recurso: 'produto_gasolina', ip_address: '201.55.12.44', status: 'ok', created_at: '2026-05-22T09:20:00Z' },
  { id: 5, cliente_nome: 'Posto Familiar ME', usuario: 'dono@postofamiliar.com.br', acao: 'auth.login_failed', recurso: 'session', ip_address: '177.99.0.1', status: 'warn', created_at: '2026-05-22T09:12:00Z' },
  { id: 6, cliente_nome: 'Rede Petro Sul S.A.', usuario: 'ti@petrosul.com.br', acao: 'grafico.create', recurso: 'tmpl-002', ip_address: '201.55.12.88', status: 'ok', created_at: '2026-05-22T08:55:00Z' },
  { id: 7, cliente_nome: 'Posto Central Ltda', usuario: 'contato@postocentral.com.br', acao: 'query.execute', recurso: 'tanques', ip_address: '192.168.1.10', status: 'ok', created_at: '2026-05-22T08:40:00Z' },
  { id: 8, cliente_nome: 'Rede Petro Sul S.A.', usuario: 'operador@petrosul.com.br', acao: 'auth.discount_approve', recurso: 'desconto_id:993', ip_address: '201.55.13.1', status: 'ok', created_at: '2026-05-22T08:30:00Z' },
]

const ACAO_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'token.generate':       Key,
  'query.execute':        Database,
  'query.blocked':        AlertTriangle,
  'price.update':         BarChart3,
  'auth.login_failed':    Shield,
  'grafico.create':       BarChart3,
  'auth.discount_approve': User,
}

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger'> = {
  ok: 'success', warn: 'warning', error: 'danger',
}
const STATUS_LABEL: Record<string, string> = { ok: 'OK', warn: 'Aviso', error: 'Bloqueado' }

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function AuditoriaPage() {
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')

  const filtered = MOCK_AUDIT.filter(entry => {
    const matchQ = !q || [entry.cliente_nome, entry.usuario, entry.acao, entry.recurso, entry.ip_address]
      .some(v => v.toLowerCase().includes(q.toLowerCase()))
    const matchStatus = filterStatus === 'todos' || entry.status === filterStatus
    return matchQ && matchStatus
  })

  return (
    <div>
      <TopBar
        title="Auditoria"
        subtitle={`${filtered.length} eventos`}
      />

      <div className="p-8 space-y-5">
        {/* Filtros */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar cliente, ação, IP..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/4 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#009c3b]/50"
            />
          </div>
          <div className="flex gap-1.5">
            {['todos', 'ok', 'warn', 'error'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                  filterStatus === s ? 'bg-[#009c3b] text-white' : 'bg-white/5 text-white/40 hover:text-white'
                }`}
              >
                {s === 'todos' ? 'Todos' : s === 'ok' ? 'OK' : s === 'warn' ? 'Avisos' : 'Erros'}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        <Card>
          <div className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-white/30 text-sm">Nenhum evento encontrado</div>
            )}
            {filtered.map(entry => {
              const Icon = ACAO_ICON[entry.acao] ?? Shield
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    entry.status === 'error' ? 'bg-red-500/10' : entry.status === 'warn' ? 'bg-yellow-500/10' : 'bg-white/5'
                  }`}>
                    <Icon size={14} className={
                      entry.status === 'error' ? 'text-red-400' : entry.status === 'warn' ? 'text-yellow-400' : 'text-white/40'
                    } />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/80 text-sm font-medium font-mono">{entry.acao}</span>
                      <Badge variant={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-white/30 text-xs">
                      <span>{entry.cliente_nome}</span>
                      <span>·</span>
                      <span>{entry.usuario}</span>
                      <span>·</span>
                      <span className="font-mono">{entry.recurso}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <span className="text-white/30 text-xs font-mono">{entry.ip_address}</span>
                    <span className="text-white/20 text-xs">{relTime(entry.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
