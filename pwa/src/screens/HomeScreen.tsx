import { useNavigate } from 'react-router-dom'
import { TrendingUp, Fuel, DollarSign, Shield, Settings, ChevronRight } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { Badge }   from '@/components/ui/Badge'

const menuItems = [
  { icon: TrendingUp, label: 'Vendas',         sub: 'Relatório do dia',      color: '#009c3b', bg: '#009c3b20', route: '/vendas',  badge: null },
  { icon: Fuel,       label: 'Estoque',        sub: 'Nível dos tanques',     color: '#3b82f6', bg: '#3b82f620', route: '/estoque', badge: null },
  { icon: DollarSign, label: 'Troca de Preço', sub: 'Atualizar valores',     color: '#f97316', bg: '#f9731620', route: '/preco',   badge: null },
  { icon: Shield,     label: 'Autorizações',   sub: 'Descontos pendentes',   color: '#fbbf24', bg: '#fbbf2420', route: '/auth',    badge: '2'  },
  { icon: Settings,   label: 'Configurações',  sub: 'Conta e preferências',  color: '#6366f1', bg: '#6366f120', route: '/config',  badge: null },
]

export function HomeScreen() {
  const { session }  = useAuth()
  const { connected } = useMQTT()
  const navigate     = useNavigate()

  const hora        = new Date().getHours()
  const saudacao    = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = session?.nome.split(' ')[0] ?? 'Gestor'

  return (
    <div className="pt-4 space-y-6">
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
