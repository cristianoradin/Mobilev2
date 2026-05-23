import { User, Building2, Shield, Bell, Sun, Moon, LogOut, Users, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth }  from '@/core/auth/AuthContext'
import { useMQTT }  from '@/core/mqtt/MQTTContext'
import { useTheme } from '@/core/theme/ThemeContext'
import { Card }     from '@/components/ui/Card'
import { Badge }    from '@/components/ui/Badge'

export function ConfigScreen() {
  const { session, logout }     = useAuth()
  const { connected }           = useMQTT()
  const { isDark, toggleTheme } = useTheme()
  const navigate                = useNavigate()

  if (!session) return null

  const roleLabel: Record<string, string> = {
    dono:     'Proprietário',
    gerente:  'Gerente',
    operador: 'Operador',
  }

  const menuGroups = [
    {
      titulo: 'Conta',
      items: [
        { icon: User,      label: 'Meu Perfil', sub: session.nome,                           onClick: undefined },
        { icon: Building2, label: 'Empresas',   sub: `${session.empresas.length} posto(s)`,  onClick: undefined },
        { icon: Shield,    label: 'Permissões', sub: roleLabel[session.role],                onClick: undefined },
        ...(session.role === 'dono' ? [{
          icon: Users,
          label: 'Usuários',
          sub: 'Gerenciar usuários e acessos',
          onClick: () => navigate('/config/usuarios'),
        }] : []),
      ],
    },
    {
      titulo: 'Preferências',
      items: [
        { icon: Bell, label: 'Notificações', sub: 'Alertas de desconto e estoque', onClick: undefined },
      ],
    },
  ]

  return (
    <div className="pt-4 space-y-6">
      {/* Perfil */}
      <div className="flex items-center gap-4 bg-surface border border-rim rounded-2xl p-5">
        <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center">
          <span className="text-primary text-xl font-bold">
            {session.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-bold text-lg truncate">{session.nome}</p>
          <p className="text-ink/40 text-sm truncate">{session.email}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="success">{roleLabel[session.role]}</Badge>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-primary' : 'bg-danger animate-pulse'}`} />
            <span className="text-xs text-ink/30">{connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Agente */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-3">Agente Local</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-ink/50">CNPJ</span>
            <span className="text-ink font-mono text-xs">{session.cnpj}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink/50">Status</span>
            <span className={connected ? 'text-primary' : 'text-danger'}>
              {connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink/50">Versão</span>
            <span className="text-ink/70">v1.0.0</span>
          </div>
        </div>
      </Card>

      {/* Menus estáticos */}
      {menuGroups.map(group => (
        <div key={group.titulo}>
          <h2 className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-3">
            {group.titulo}
          </h2>
          <Card>
            <div className="divide-y divide-rim">
              {group.items.map(({ icon: Icon, label, sub, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-ink/5 transition-colors text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <Icon size={18} className={onClick ? 'text-primary' : 'text-ink/50'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-ink text-sm font-medium">{label}</p>
                    {sub && <p className="text-ink/40 text-xs mt-0.5">{sub}</p>}
                  </div>
                  {onClick && <ChevronRight size={14} className="text-ink/30" />}
                </button>
              ))}
            </div>
          </Card>
        </div>
      ))}

      {/* Toggle de tema */}
      <div>
        <h2 className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-3">
          Aparência
        </h2>
        <Card>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-ink/5 transition-colors text-left"
          >
            {isDark
              ? <Sun  size={18} className="text-yellow" />
              : <Moon size={18} className="text-purple" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-ink text-sm font-medium">Tema</p>
              <p className="text-ink/40 text-xs mt-0.5">
                {isDark ? 'Escuro (ativo) — toque para ativar o claro' : 'Claro (ativo) — toque para ativar o escuro'}
              </p>
            </div>
            {/* Switch visual */}
            <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-surface2' : 'bg-primary'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-ink shadow transition-all duration-300 ${isDark ? 'left-1' : 'left-7'}`} />
            </div>
          </button>
        </Card>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-4 bg-danger/10 border border-danger/30 rounded-2xl text-danger font-semibold transition-all active:scale-[0.98]"
      >
        <LogOut size={18} />
        Sair da conta
      </button>

      <p className="text-center text-ink/20 text-xs pb-2">
        SGA Petro Mobile v1.0.0 — Tecnologia proprietária
      </p>
    </div>
  )
}
