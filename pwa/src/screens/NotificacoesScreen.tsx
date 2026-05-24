import { useState, useEffect } from 'react'
import { useNavigate }  from 'react-router-dom'
import { ArrowLeft, Bell, Globe, Users, Clock } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { Card }   from '@/components/ui/Card'

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

export function NotificacoesScreen() {
  const { session }  = useAuth()
  const navigate     = useNavigate()
  const [items,    setItems]    = useState<HistItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    if (!session) return
    const cnpj = session.cnpj.replace(/\D/g, '')
    fetch(`/api/push/history?cnpj=${cnpj}&limit=50`)
      .then(r => r.json())
      .then((d: { history: HistItem[] }) => setItems(d.history ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [session])

  function formatDate(iso: string) {
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)

    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`
    if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` · ${hora}`
  }

  return (
    <div className="pt-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/config')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-rim hover:bg-surface2 transition-colors"
        >
          <ArrowLeft size={18} className="text-ink/60" />
        </button>
        <div>
          <h1 className="text-ink font-bold text-lg leading-tight">Notificações</h1>
          <p className="text-ink/40 text-xs">Comunicados recebidos</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <Bell size={28} className="text-ink/20 mx-auto mb-3" />
          <p className="text-ink/40 text-sm">Erro ao carregar notificações</p>
          <button
            onClick={() => { setError(false); setLoading(true) }}
            className="mt-3 text-primary text-sm font-medium"
          >
            Tentar novamente
          </button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell size={32} className="text-ink/15 mx-auto mb-3" />
          <p className="text-ink font-semibold text-sm mb-1">Nenhuma notificação</p>
          <p className="text-ink/40 text-xs">Os comunicados enviados pelo portal aparecerão aqui</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Ícone */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  item.para_todos
                    ? 'bg-primary/15'
                    : 'bg-blue/15'
                }`}>
                  {item.para_todos
                    ? <Globe size={16} className="text-primary" />
                    : <Users size={16} className="text-blue-400" />
                  }
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-semibold text-sm mb-0.5">{item.title}</p>
                  <p className="text-ink/60 text-xs leading-relaxed mb-2">{item.body}</p>
                  <div className="flex items-center gap-1 text-ink/30 text-[10px]">
                    <Clock size={9} />
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
