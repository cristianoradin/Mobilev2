import { useState, useEffect } from 'react'
import { PanelsTopLeft, RefreshCw, BarChart3, LineChart, PieChart,
  Gauge, TrendingUp, TableProperties, Flame, Layers, WifiOff } from 'lucide-react'
import { Card }  from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/core/auth/AuthContext'

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

const ICON_MAP: Record<string, React.ElementType> = {
  line:  LineChart, bar: BarChart3, pie: PieChart, gauge: Gauge,
  area: TrendingUp, report: TableProperties, kpi: Flame, heatmap: Layers,
}

interface Widget {
  id: string; template_id: string; size: string; order: number
}
interface DashItem {
  id: string; nome: string; descricao?: string | null; cor: string; widgets: Widget[]
}

export function DashboardsScreen() {
  const { session } = useAuth()
  const [dashboards, setDashboards] = useState<DashItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  async function carregar() {
    if (!session?.jwt) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${PORTAL_URL}/api/mobile/dashboards`, {
        headers: { Authorization: `Bearer ${session.jwt}` },
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setDashboards(data.dashboards ?? [])
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
          <h1 className="text-xl font-bold text-ink">Dashboards</h1>
          <p className="text-ink/40 text-sm">Painéis liberados para o seu posto</p>
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
          <p className="text-ink/40 text-sm">Carregando dashboards…</p>
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <WifiOff size={32} className="text-ink/20" />
          <p className="text-ink/40 text-sm">Não foi possível carregar</p>
          <button onClick={carregar} className="text-primary text-sm font-medium">Tentar novamente</button>
        </div>
      )}

      {/* Vazio */}
      {!loading && !error && dashboards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <PanelsTopLeft size={28} className="text-primary" />
          </div>
          <p className="text-ink/50 text-sm">Nenhum dashboard liberado ainda</p>
          <p className="text-ink/25 text-xs text-center px-8">
            Peça ao administrador para liberar dashboards para seu posto
          </p>
        </div>
      )}

      {/* Lista */}
      {!loading && !error && dashboards.length > 0 && (
        <div className="space-y-3">
          {dashboards.map(dash => (
            <Card key={dash.id} className="p-5">
              <div className="flex items-start gap-3">
                {/* Ícone colorido */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: (dash.cor ?? '#009c3b') + '18',
                    border:          `1px solid ${(dash.cor ?? '#009c3b')}30`,
                  }}
                >
                  <PanelsTopLeft size={22} style={{ color: dash.cor ?? '#009c3b' }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-ink font-semibold text-sm">{dash.nome}</p>
                    <Badge variant="default" size="sm">{dash.widgets.length} widgets</Badge>
                  </div>
                  {dash.descricao && (
                    <p className="text-ink/40 text-xs mb-3 line-clamp-2">{dash.descricao}</p>
                  )}

                  {/* Preview dos widgets */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[...dash.widgets]
                      .sort((a, b) => a.order - b.order)
                      .map(w => {
                        // Determina o tipo do template pelo prefixo do ID
                        const tmplNum = parseInt(w.template_id.replace('tmpl-', ''))
                        const types: Record<number, string> = {
                          1:'area',2:'gauge',3:'pie',4:'bar',5:'report',
                          6:'kpi',7:'heatmap',8:'waterfall',9:'button',
                        }
                        const chartType = types[tmplNum] ?? 'bar'
                        const Icon = ICON_MAP[chartType] ?? BarChart3
                        const span = w.size === '3' ? 'col-span-3' : w.size === '2' ? 'col-span-2' : 'col-span-1'
                        return (
                          <div
                            key={w.id}
                            className={`${span} flex items-center gap-1.5 bg-ink/5 border border-rim rounded-lg px-2 py-1.5`}
                          >
                            <Icon size={11} className="text-ink/40 flex-shrink-0" />
                            <span className="text-ink/50 text-[10px] truncate">{w.template_id}</span>
                          </div>
                        )
                      })}
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
