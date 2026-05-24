import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { useChartData } from '@/hooks/useChartData'
import { TankWidget }    from '@/components/charts/TankWidget'
import { DynamicChart }  from '@/components/charts/DynamicChart'
import type { ChartMetadata } from '@/lib/contracts'

// ─── Dispara push notification local via Service Worker ───────────────────────
async function notifyTankCritical(produto: string, pct: number, volume: number, unidade: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const tag  = `tank-critical-${produto.toLowerCase().replace(/\s+/g, '-')}`
  const body = `Nível ${pct.toFixed(1)}% — ${volume.toLocaleString('pt-BR')} ${unidade}`

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    if (reg) {
      await reg.showNotification(`⚠️ Tanque Crítico — ${produto}`, {
        body,
        icon:  '/logo.png',
        badge: '/icons/icon-192.png',
        tag,
        data:  { route: '/estoque', priority: 'high' },
        ...({ vibrate: [300, 150, 300] } as object),
      } as NotificationOptions)
      return
    }
  }
  // Fallback inline
  new Notification(`⚠️ Tanque Crítico — ${produto}`, { body, icon: '/logo.png', tag })
}

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

// ─── Tela de detalhe de um template ──────────────────────────────────────────
export function GraficoDetailScreen() {
  const { id }         = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const location       = useLocation()
  const { session }    = useAuth()

  // Tenta usar template passado via navigation state (evita re-fetch)
  const stateTemplate  = (location.state as { template?: ChartMetadata } | null)?.template

  const [template, setTemplate] = useState<ChartMetadata | null>(stateTemplate ?? null)
  const [fetching, setFetching] = useState(!stateTemplate)
  const [fetchErr, setFetchErr] = useState(false)

  useEffect(() => {
    if (stateTemplate || !id || !session?.jwt) return
    setFetching(true)
    fetch(`${PORTAL_URL}/api/mobile/graficos`, {
      headers: { Authorization: `Bearer ${session.jwt}` },
    })
      .then(r => r.json())
      .then(data => {
        const tmpl = (data.graficos ?? []).find((g: ChartMetadata) => g.id === id)
        setTemplate(tmpl ?? null)
        if (!tmpl) setFetchErr(true)
      })
      .catch(() => setFetchErr(true))
      .finally(() => setFetching(false))
  }, [id, session?.jwt, stateTemplate])

  if (fetching) return <LoadingView />
  if (fetchErr || !template) return <NotFoundView onBack={() => navigate('/graficos')} />

  return <ChartView template={template} onBack={() => navigate('/graficos')} />
}

// ─── View principal com dados ─────────────────────────────────────────────────
function ChartView({ template, onBack }: { template: ChartMetadata; onBack: () => void }) {
  const { data, loading, error, agentOnline, stale, lastUpdate, refresh } = useChartData(template)

  // Guarda quais tanques já foram notificados nesta sessão (evita flood)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!data || data.length === 0 || template.chart_type !== 'tank') return

    const cfg  = template.tank_config
    const tLow = cfg?.threshold_low    ?? 25
    const fProd = cfg?.field_produto   ?? 'produto'
    const fVol  = cfg?.field_volume    ?? 'volume'
    const fCap  = cfg?.field_capacidade ?? 'capacidade'
    const fPct  = cfg?.field_percentual
    const unit  = cfg?.unidade         ?? 'L'

    data.forEach(row => {
      const vol = Number(row[fVol] ?? 0)
      const cap = Number(row[fCap] ?? 1)
      const pct = fPct ? Number(row[fPct] ?? 0) : (cap > 0 ? (vol / cap) * 100 : 0)
      const produto = String(row[fProd] ?? '')

      if (pct < tLow && !notifiedRef.current.has(produto)) {
        notifiedRef.current.add(produto)
        notifyTankCritical(produto, pct, vol, unit)
      }
      // Se nível se recuperou, permite notificar novamente na próxima vez
      if (pct >= tLow) {
        notifiedRef.current.delete(produto)
      }
    })
  }, [data, template])

  function fmtTime(d: Date | null) {
    if (!d) return ''
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="pt-4 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-surface border border-rim active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} className="text-ink/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-ink leading-tight truncate">{template.nome}</h1>
          {template.descricao && (
            <p className="text-ink/40 text-xs mt-0.5 line-clamp-1">{template.descricao}</p>
          )}
        </div>
        <button
          onClick={() => refresh(true)}
          className="p-2 rounded-xl bg-surface border border-rim active:scale-95 transition-transform"
        >
          <RefreshCw size={15} className={`text-ink/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 text-[11px] text-ink/30 flex-wrap">
        <span className="flex items-center gap-1">
          {agentOnline
            ? <Wifi size={11} className="text-primary" />
            : <WifiOff size={11} className="text-red-400" />
          }
          <span>{agentOnline ? 'Agente online' : 'Agente offline'}</span>
        </span>

        {lastUpdate && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {fmtTime(lastUpdate)}
          </span>
        )}

        {stale && (
          <span className="text-amber-400/70 font-medium">• dados desatualizados</span>
        )}
        {!data && !loading && !error && (
          <span className="text-white/20">• dados simulados</span>
        )}
        {error && (
          <span className="text-red-400/70">• {error}</span>
        )}
      </div>

      {/* Widget */}
      {template.chart_type === 'tank' ? (
        <TankWidget metadata={template} data={data} loading={loading} />
      ) : (
        <DynamicChart metadata={template} data={data ?? []} loading={loading} />
      )}
    </div>
  )
}

// ─── Estados auxiliares ───────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-ink/40 text-sm">Carregando template…</p>
      </div>
    </div>
  )
}

function NotFoundView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-ink/50 text-sm font-medium">Template não encontrado</p>
      <p className="text-ink/30 text-xs">Verifique se ele ainda está liberado para você</p>
      <button onClick={onBack} className="mt-2 text-primary text-sm font-semibold active:opacity-70">
        Voltar para Gráficos
      </button>
    </div>
  )
}
