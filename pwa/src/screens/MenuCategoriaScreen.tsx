/**
 * MenuCategoriaScreen — lista templates filtrados por categoria.
 * Cards estilo home menu (TemplateCard).
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, WifiOff, DollarSign, Shield, ChevronRight } from 'lucide-react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TemplateCard } from '@/components/ui/TemplateCard'
import { useAuth }      from '@/core/auth/AuthContext'
import { getMenuByCategoria } from '@/lib/menus'
import type { MenuCategoria } from '@/lib/menus'
import type { ChartMetadata } from '@/lib/contracts'

// Atalhos built-in por categoria — apps internos antes de qualquer template
const BUILTIN_LINKS: Partial<Record<MenuCategoria, Array<{
  route: string; label: string; subtitle: string; iconBg: string; iconColor: string
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
}>>> = {
  operacoes: [
    { route: '/preco', label: 'Troca de Preço', subtitle: 'Atualizar valores',   iconBg: '#FFD9B3', iconColor: '#D66820', icon: DollarSign },
    { route: '/auth',  label: 'Autorizações',   subtitle: 'Descontos pendentes', iconBg: '#FFEAB3', iconColor: '#CC8F15', icon: Shield     },
  ],
}

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

interface Props {
  categoria: MenuCategoria
}

export function MenuCategoriaScreen({ categoria }: Props) {
  const { session } = useAuth()
  const navigate    = useNavigate()
  const menu        = getMenuByCategoria(categoria)

  const [graficos, setGraficos] = useState<(ChartMetadata & { descricao?: string })[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  async function carregar() {
    if (!session?.jwt) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${PORTAL_URL}/api/mobile/graficos`, {
        headers: { Authorization: `Bearer ${session.jwt}` },
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as { graficos?: ChartMetadata[] }
      setGraficos(data.graficos ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [session?.jwt]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(
    () => graficos.filter(g => (g.categoria ?? '').toLowerCase() === categoria),
    [graficos, categoria],
  )

  if (!menu) return null
  const MenuIcon = menu.icon
  const builtins = BUILTIN_LINKS[categoria] ?? []

  return (
    <div className="pt-2 space-y-4">
      <ScreenHeader
        title={menu.label}
        subtitle={`${builtins.length + filtrados.length} ite${(builtins.length + filtrados.length) === 1 ? 'm' : 'ns'} disponíve${(builtins.length + filtrados.length) === 1 ? 'l' : 'is'}`}
        action={
          <button
            onClick={carregar}
            className="p-2.5 bg-surface rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-rim/40 active:scale-90 transition-all"
          >
            <RefreshCw size={16} className={`text-ink/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Atalhos built-in (Troca de Preço, Autorizações, etc) */}
      {builtins.length > 0 && (
        <div className="space-y-3">
          {builtins.map(b => {
            const Icon = b.icon
            return (
              <button
                key={b.route}
                onClick={() => navigate(b.route)}
                className="w-full flex items-center gap-4 bg-surface rounded-2xl p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-transparent hover:border-rim transition-all duration-200 active:scale-[0.98]"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.iconBg }}>
                  <Icon size={26} color={b.iconColor} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-semibold text-[17px] leading-tight">{b.label}</p>
                  <p className="text-ink/50 text-[13px] mt-0.5">{b.subtitle}</p>
                </div>
                <ChevronRight size={18} className="text-ink/30 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-ink/40 text-sm">Carregando…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <WifiOff size={28} className="text-ink/20" />
          <p className="text-ink/40 text-sm">Falha ao carregar</p>
          <button onClick={carregar} className="text-primary text-xs hover:underline">Tentar novamente</button>
        </div>
      )}

      {!loading && !error && filtrados.length === 0 && builtins.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 bg-surface border border-rim rounded-2xl flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <MenuIcon size={28} className="text-ink/25" />
          </div>
          <div className="text-center">
            <p className="text-ink/50 text-sm font-medium">Sem relatórios em {menu.label}</p>
            <p className="text-ink/30 text-xs mt-1 max-w-xs">
              Crie templates no portal e atribua ao menu "{menu.label}"
            </p>
          </div>
        </div>
      )}

      {!loading && !error && filtrados.length > 0 && (
        <div className="space-y-3">
          {filtrados.map(g => (
            <TemplateCard
              key={g.id}
              template={g}
              onClick={() => navigate(`/graficos/${g.id}`, { state: { template: g } })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
