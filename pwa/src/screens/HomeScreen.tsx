import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Fuel, DollarSign, Shield, Settings, ChevronRight,
  BarChart3, PanelsTopLeft, Megaphone } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { Badge }   from '@/components/ui/Badge'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PropagandaData {
  id:            string
  titulo:        string
  descricao:     string
  imagem:        string | null
  expires_at:    string | null
  duracao_horas: number
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cloud.gruposgapetro.com.br'

// ─── Banner de propaganda ─────────────────────────────────────────────────────
function PropagandaBanner({ session }: { session: { jwt: string } | null }) {
  const [prop,     setProp]     = useState<PropagandaData | null>(null)
  const [visible,  setVisible]  = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!session?.jwt) return
    fetch(`${API_URL}/api/mobile/propaganda`, {
      headers: { Authorization: `Bearer ${session.jwt}` },
    })
      .then(r => r.json())
      .then((d: { propaganda?: PropagandaData | null }) => {
        const p = d.propaganda
        if (!p) return

        setProp(p)
        setVisible(true)

        // Esconde automaticamente quando a propaganda expirar
        if (p.expires_at) {
          const msLeft = new Date(p.expires_at).getTime() - Date.now()
          if (msLeft > 0) {
            const timer = setTimeout(() => setVisible(false), msLeft)
            return () => clearTimeout(timer)
          }
        }
      })
      .catch(() => {})
  }, [session?.jwt])

  if (!visible || !prop) return null

  return (
    // A propaganda não pode ser fechada pelo usuário — respeita a duração definida no portal
    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-surface shadow-lg shadow-primary/5 animate-fade-in">
      {/* Imagem */}
      {prop.imagem && !imgError && (
        <div className="relative w-full h-40 overflow-hidden">
          <img
            src={prop.imagem}
            alt={prop.titulo}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          {/* Gradiente de leitura */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      )}

      {/* Conteúdo */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Megaphone size={12} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ink font-bold text-sm leading-tight">{prop.titulo}</p>
            {prop.descricao && (
              <p className="text-ink/55 text-xs mt-1 leading-relaxed line-clamp-3">{prop.descricao}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const menuItems = [
  { icon: TrendingUp,     label: 'Vendas',         sub: 'Relatório do dia',           color: '#009c3b', bg: '#009c3b20', route: '/vendas',      badge: null },
  { icon: Fuel,           label: 'Estoque',        sub: 'Nível dos tanques',          color: '#3b82f6', bg: '#3b82f620', route: '/estoque',     badge: null },
  { icon: DollarSign,     label: 'Troca de Preço', sub: 'Atualizar valores',          color: '#f97316', bg: '#f9731620', route: '/preco',       badge: null },
  { icon: Shield,         label: 'Autorizações',   sub: 'Descontos pendentes',        color: '#fbbf24', bg: '#fbbf2420', route: '/auth',        badge: '2'  },
  { icon: BarChart3,      label: 'Gráficos',       sub: 'Templates disponíveis',      color: '#6366f1', bg: '#6366f120', route: '/graficos',    badge: null },
  { icon: PanelsTopLeft,  label: 'Dashboards',     sub: 'Painéis liberados',          color: '#ec4899', bg: '#ec489920', route: '/dashboards',  badge: null },
  { icon: Settings,       label: 'Configurações',  sub: 'Conta e preferências',       color: '#64748b', bg: '#64748b20', route: '/config',      badge: null },
]

export function HomeScreen() {
  const { session }   = useAuth()
  const { connected } = useMQTT()
  const navigate      = useNavigate()

  const hora         = new Date().getHours()
  const saudacao     = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = session?.nome.split(' ')[0] ?? 'Gestor'

  return (
    <div className="pt-4 space-y-6">
      {/* Banner de propaganda (exibido quando ativo) */}
      <PropagandaBanner session={session} />
      {/* Saudação */}
      <div>
        <p className="text-ink/50 text-sm">{saudacao},</p>
        <h1 className="text-2xl font-bold text-ink">{primeiroNome} 👋</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary' : 'bg-danger animate-pulse'}`} />
          <span className="text-xs text-ink/40">
            {connected ? 'Agente conectado' : 'Agente offline — modo cache'}
          </span>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-rim rounded-2xl p-4">
          <p className="text-ink/50 text-xs mb-1">Vendas Hoje</p>
          <p className="text-2xl font-bold text-ink">R$ 12.847</p>
          <p className="text-primary text-xs mt-1">+8.3% vs ontem</p>
        </div>
        <div className="bg-surface border border-rim rounded-2xl p-4">
          <p className="text-ink/50 text-xs mb-1">Litros Vendidos</p>
          <p className="text-2xl font-bold text-ink">2.341 L</p>
          <p className="text-blue text-xs mt-1">4 bicos ativos</p>
        </div>
      </div>

      {/* Menu Principal */}
      <div>
        <h2 className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-3">
          Menu Principal
        </h2>
        <div className="space-y-3">
          {menuItems.map(({ icon: Icon, label, sub, color, bg, route, badge }) => (
            <button
              key={route}
              onClick={() => navigate(route)}
              className="w-full flex items-center gap-4 bg-surface border border-rim rounded-2xl p-5 transition-all duration-200 active:scale-[0.97] hover:border-rim2 text-left"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: bg }}
              >
                <Icon size={28} color={color} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-ink font-semibold text-[17px]">{label}</p>
                  {badge && <Badge variant="warning" size="sm">{badge}</Badge>}
                </div>
                <p className="text-ink/50 text-[13px] mt-0.5">{sub}</p>
              </div>
              <ChevronRight size={18} className="text-ink/30 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
