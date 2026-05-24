import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, LineChart, PieChart, Gauge, TrendingUp, RefreshCw,
  TableProperties, Flame, Layers, MousePointerClick, WifiOff, Fuel, ChevronRight } from 'lucide-react'
import { Card }  from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/core/auth/AuthContext'
import type { ChartMetadata } from '@/lib/contracts'

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

const ICON_MAP: Record<string, React.ElementType> = {
  line:      LineChart,
  bar:       BarChart3,
  pie:       PieChart,
  gauge:     Gauge,
  area:      TrendingUp,
  report:    TableProperties,
  kpi:       Flame,
  heatmap:   Layers,
  waterfall: BarChart3,
  button:    MousePointerClick,
  tank:      Fuel,
}

const COLOR_MAP: Record<string, string> = {
  vendas:      '#009c3b',
  estoque:     '#3b82f6',
  financeiro:  '#fbbf24',
  operacional: '#f97316',
  geral:       '#6366f1',
}

const BADGE_MAP: Record<string, 'success'|'info'|'warning'|'danger'|'default'> = {
  vendas:      'success',
  estoque:     'info',
  financeiro:  'warning',
  operacional: 'default',
}

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Gráficos</h1>
          <p className="text-ink/40 text-sm">Templates disponíveis para o seu posto</p>
        </div>
        <button
          onClick={carregar}
          className="p-2.5 bg-surface border border-rim rounded-xl transition-all active:scale-90"
        >
          <RefreshCw size={16} className={`text-ink/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

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

      {/* Lista de gráficos */}
      {!loading && !error && graficos.length > 0 && (
        <div className="space-y-3">
          {graficos.map(g => {
            const Icon  = ICON_MAP[g.chart_type] ?? BarChart3
            const color = COLOR_MAP[g.categoria ?? 'geral'] ?? '#6366f1'
            const bv    = BADGE_MAP[g.categoria ?? 'geral'] ?? 'default'
            return (
              <Card
                key={g.id}
                className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/graficos/${g.id}`, { state: { template: g } })}
              >
                <div className="flex items-start gap-3">
                  {/* Ícone */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Icon size={18} style={{ color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-ink font-semibold text-sm">{g.nome}</p>
                      {g.categoria && (
                        <Badge variant={bv} size="sm">{g.categoria}</Badge>
                      )}
                    </div>
                    {g.descricao && (
                      <p className="text-ink/40 text-xs mt-0.5 line-clamp-2">{g.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink/30">
                      <span className="capitalize">{g.chart_type}</span>
                      {g.query.refresh_seconds > 0 && (
                        <span>Refresh: {g.query.refresh_seconds}s</span>
                      )}
                      <span>Role: {g.permissions.min_role}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-ink/20 flex-shrink-0 mt-0.5" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
