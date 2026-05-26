import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, RefreshCw, WifiOff } from 'lucide-react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TemplateCard } from '@/components/ui/TemplateCard'
import { useAuth } from '@/core/auth/AuthContext'
import type { ChartMetadata } from '@/lib/contracts'

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

export function GraficosScreen() {
  const { session } = useAuth()
  const navigate    = useNavigate()
  const [graficos, setGraficos] = useState<(ChartMetadata & { categoria?: string; descricao?: string })[]>([])
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
      const data = await res.json()
      setGraficos(data.graficos ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [session?.jwt]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pt-4 space-y-5">
      <ScreenHeader
        title="Gráficos"
        subtitle="Templates disponíveis para o seu posto"
        action={
          <button
            onClick={carregar}
            className="p-2.5 bg-surface rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-rim/40 transition-all active:scale-90"
          >
            <RefreshCw size={16} className={`text-ink/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-ink/40 text-sm">Carregando gráficos…</p>
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <WifiOff size={32} className="text-ink/20" />
          <p className="text-ink/40 text-sm">Não foi possível carregar</p>
          <button onClick={carregar} className="text-primary text-sm font-medium">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Vazio */}
      {!loading && !error && graficos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <BarChart3 size={28} className="text-primary" />
          </div>
          <p className="text-ink/50 text-sm">Nenhum gráfico liberado ainda</p>
          <p className="text-ink/25 text-xs text-center px-8">
            Peça ao administrador para liberar templates para seu posto
          </p>
        </div>
      )}

      {/* Lista de gráficos — estilo home menu */}
      {!loading && !error && graficos.length > 0 && (
        <div className="space-y-3">
          {graficos.map(g => (
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
