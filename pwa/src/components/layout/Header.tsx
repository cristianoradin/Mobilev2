import { useState } from 'react'
import { ChevronDown, Wifi, WifiOff, LogOut, Sun, Moon } from 'lucide-react'
import { useAuth }   from '@/core/auth/AuthContext'
import { useEmpresa } from '@/core/empresa/EmpresaContext'
import { useMQTT }   from '@/core/mqtt/MQTTContext'
import { useTheme }  from '@/core/theme/ThemeContext'
import { cn }        from '@/lib/cn'

export function Header() {
  const { session, logout }                               = useAuth()
  const { empresaSelecionada, setEmpresaSelecionada, todas } = useEmpresa()
  const { connected }                                     = useMQTT()
  const { isDark, toggleTheme }                           = useTheme()
  const [showDropdown, setShowDropdown]                   = useState(false)

  if (!session) return null

  const empresas   = session.empresas
  const displayName = todas ? 'Todas as Empresas' : empresaSelecionada?.nome ?? 'Selecionar'

  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-md border-b border-rim transition-colors duration-200">
      <div className="flex items-center justify-between px-5 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-black text-xs">SGA</span>
          </div>
          <span className="text-ink font-bold text-base">Petro</span>
        </div>

        {/* Seletor de empresa */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-surface border border-rim rounded-xl px-3 py-2 transition-all active:scale-95"
          >
            <span className="text-ink text-sm font-medium max-w-[120px] truncate">{displayName}</span>
            <ChevronDown
              size={14}
              className={cn('text-ink/50 transition-transform', showDropdown && 'rotate-180')}
            />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-rim rounded-2xl shadow-xl overflow-hidden z-50">
              <button
                onClick={() => { setEmpresaSelecionada(null); setShowDropdown(false) }}
                className={cn(
                  'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-ink/5',
                  todas ? 'text-primary font-semibold' : 'text-ink'
                )}
              >
                Todas as Empresas
              </button>
              {empresas.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEmpresaSelecionada(e); setShowDropdown(false) }}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm border-t border-rim transition-colors hover:bg-ink/5',
                    empresaSelecionada?.id === e.id ? 'text-primary font-semibold' : 'text-ink'
                  )}
                >
                  {e.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status + toggle tema + logout */}
        <div className="flex items-center gap-1.5">
          {connected
            ? <Wifi size={16} className="text-primary" />
            : <WifiOff size={16} className="text-danger animate-pulse" />
          }

          {/* Botão tema */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-1.5 rounded-lg hover:bg-ink/10 transition-colors"
          >
            {isDark
              ? <Sun  size={16} className="text-ink/60" />
              : <Moon size={16} className="text-ink/60" />
            }
          </button>

          <button onClick={logout} className="p-1.5 rounded-lg hover:bg-ink/10 transition-colors">
            <LogOut size={16} className="text-ink/50" />
          </button>
        </div>
      </div>
    </header>
  )
}
