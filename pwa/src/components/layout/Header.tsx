import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Wifi, WifiOff } from 'lucide-react'
import { useAuth }    from '@/core/auth/AuthContext'
import { useEmpresa } from '@/core/empresa/EmpresaContext'
import { useMQTT }    from '@/core/mqtt/MQTTContext'
import { cn }         from '@/lib/cn'

export function Header() {
  const { session }                                            = useAuth()
  const { empresaSelecionada, setEmpresaSelecionada, todas }   = useEmpresa()
  const { connected }                                          = useMQTT()
  const [showDropdown, setShowDropdown]                        = useState(false)
  const navigate                                                = useNavigate()

  if (!session) return null

  const empresas      = session.empresas
  const empresaUnica  = empresas.length === 1
  // Master = posto principal do cliente (BCA, etc). Usa quando "Todas" pra mostrar nome real.
  const empresaMaster = empresas.find(e => e.is_master) ?? empresas[0] ?? null
  const displayName   = empresaSelecionada
    ? empresaSelecionada.nome
    : empresaMaster?.nome ?? 'Selecionar'

  // Se só tem 1 empresa, botão vira display puro (sem dropdown).
  const handleClick = empresaUnica ? undefined : () => setShowDropdown(!showDropdown)

  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-md border-b border-rim/60 pt-safe">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 max-w-lg mx-auto">
        {/* Logo — clicar abre Configurações (substitui o item Config do BottomNav) */}
        <button
          onClick={() => navigate('/config')}
          className="flex-shrink-0 rounded-lg p-1 -m-1 transition-all active:scale-90 hover:opacity-80"
          aria-label="Abrir configurações"
          title="Configurações"
        >
          <img
            src="/logo-topo.png"
            alt="SGA Petro"
            className="h-7 w-auto object-contain"
          />
        </button>

        {/* Seletor de empresa — flex-1 ocupa restante; cresce até 320px */}
        <div className="relative flex-1 max-w-[320px] ml-auto">
          <button
            onClick={handleClick}
            className={cn(
              'w-full flex items-center gap-2 bg-surface rounded-xl px-3 py-2',
              'shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all',
              empresaUnica ? 'cursor-default' : 'active:scale-95',
            )}
          >
            {connected
              ? <Wifi    size={14} className="text-primary flex-shrink-0" />
              : <WifiOff size={14} className="text-danger animate-pulse flex-shrink-0" />
            }
            <span className="text-ink text-[13px] font-semibold flex-1 truncate text-left">{displayName}</span>
            {!empresaUnica && (
              <ChevronDown
                size={12}
                className={cn('text-ink/40 transition-transform flex-shrink-0', showDropdown && 'rotate-180')}
              />
            )}
          </button>

          {!empresaUnica && showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-rim rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
              {/* "Todas" só aparece se houver >1 empresa */}
              <button
                onClick={() => { setEmpresaSelecionada(null); setShowDropdown(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-ink/5',
                  todas ? 'text-primary font-semibold' : 'text-ink',
                )}
              >
                {connected
                  ? <Wifi    size={13} className="text-primary flex-shrink-0" />
                  : <WifiOff size={13} className="text-danger animate-pulse flex-shrink-0" />
                }
                Todas as Empresas
              </button>

              {/* Cada empresa */}
              {empresas.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEmpresaSelecionada(e); setShowDropdown(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-3 text-sm border-t border-rim transition-colors hover:bg-ink/5 text-left',
                    empresaSelecionada?.id === e.id ? 'text-primary font-semibold' : 'text-ink',
                  )}
                >
                  {connected
                    ? <Wifi    size={13} className="text-primary flex-shrink-0" />
                    : <WifiOff size={13} className="text-danger animate-pulse flex-shrink-0" />
                  }
                  <span className="truncate">{e.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
