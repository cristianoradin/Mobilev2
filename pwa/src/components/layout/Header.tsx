import { useState } from 'react'
import { ChevronDown, Wifi, WifiOff } from 'lucide-react'
import { useAuth }   from '@/core/auth/AuthContext'
import { useEmpresa } from '@/core/empresa/EmpresaContext'
import { useMQTT }   from '@/core/mqtt/MQTTContext'
import { cn }        from '@/lib/cn'

export function Header() {
  const { session }                                        = useAuth()
  const { empresaSelecionada, setEmpresaSelecionada, todas } = useEmpresa()
  const { connected }                                      = useMQTT()
  const [showDropdown, setShowDropdown]                    = useState(false)

  if (!session) return null

  const empresas   = session.empresas
  const displayName = todas ? 'Todas as Empresas' : empresaSelecionada?.nome ?? 'Selecionar'

  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-md border-b border-rim transition-colors duration-200 pt-safe">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="SGA Petro"
          className="h-7 w-auto object-contain"
        />

        {/* Seletor de empresa */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-surface border border-rim rounded-xl px-3 py-2 transition-all active:scale-95"
          >
            {/* Ícone de conexão — verde=online, vermelho pulsando=offline */}
            {connected
              ? <Wifi    size={14} className="text-primary flex-shrink-0" />
              : <WifiOff size={14} className="text-danger animate-pulse flex-shrink-0" />
            }
            <span className="text-ink text-sm font-medium max-w-[110px] truncate">{displayName}</span>
            <ChevronDown
              size={14}
              className={cn('text-ink/50 transition-transform', showDropdown && 'rotate-180')}
            />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-rim rounded-2xl shadow-xl overflow-hidden z-50">
              {/* Todas as empresas */}
              <button
                onClick={() => { setEmpresaSelecionada(null); setShowDropdown(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-ink/5',
                  todas ? 'text-primary font-semibold' : 'text-ink'
                )}
              >
                {connected
                  ? <Wifi    size={13} className="text-primary flex-shrink-0" />
                  : <WifiOff size={13} className="text-danger animate-pulse flex-shrink-0" />
                }
                Todas as Empresas
              </button>

              {/* Cada posto */}
              {empresas.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEmpresaSelecionada(e); setShowDropdown(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-3 text-sm border-t border-rim transition-colors hover:bg-ink/5',
                    empresaSelecionada?.id === e.id ? 'text-primary font-semibold' : 'text-ink'
                  )}
                >
                  {connected
                    ? <Wifi    size={13} className="text-primary flex-shrink-0" />
                    : <WifiOff size={13} className="text-danger animate-pulse flex-shrink-0" />
                  }
                  {e.nome}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
