import { useState, useEffect } from 'react'
import { Megaphone, Sparkles } from 'lucide-react'
import { useAuth }       from '@/core/auth/AuthContext'
import { useMQTT }       from '@/core/mqtt/MQTTContext'
import { RobotIcon }     from '@/components/ui/RobotIcon'
import { WeatherInline } from '@/components/ui/WeatherInline'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PropagandaData {
  id:            string
  titulo:        string
  descricao:     string
  imagem:        string | null
  expires_at:    string | null
  duracao_horas: number
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://cloud.gruposgapetro.com.br'

// ─── Single propaganda card ──────────────────────────────────────────────────
function PropagandaCard({ prop, imgError, onImgError }: {
  prop: PropagandaData
  imgError: boolean
  onImgError: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
      {prop.imagem && !imgError && (
        <div className="relative w-full h-40 overflow-hidden">
          <img src={prop.imagem} alt={prop.titulo} className="w-full h-full object-cover" onError={onImgError} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      )}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Megaphone size={12} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ink font-bold text-sm leading-tight">{prop.titulo}</p>
            {prop.descricao && <p className="text-ink/55 text-xs mt-1 leading-relaxed line-clamp-3">{prop.descricao}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Carousel propagandas ─────────────────────────────────────────────────────
function PropagandaBanner({ session }: { session: { jwt: string } | null }) {
  const [list,      setList]      = useState<PropagandaData[]>([])
  const [idx,       setIdx]       = useState(0)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!session?.jwt) return
    fetch(`${API_URL}/api/mobile/propaganda`, { headers: { Authorization: `Bearer ${session.jwt}` } })
      .then(r => r.json())
      .then((d: { propagandas?: PropagandaData[]; propaganda?: PropagandaData | null }) => {
        const items = d.propagandas ?? (d.propaganda ? [d.propaganda] : [])
        setList(items)
      })
      .catch(() => {})
  }, [session?.jwt])

  useEffect(() => {
    if (list.length < 2) return
    const id = setInterval(() => setIdx(i => (i + 1) % list.length), 5000)
    return () => clearInterval(id)
  }, [list.length])

  useEffect(() => {
    if (list.length === 0) return
    const timers = list.filter(p => p.expires_at).map(p => {
      const msLeft = new Date(p.expires_at!).getTime() - Date.now()
      if (msLeft <= 0) return null
      return setTimeout(() => { setList(curr => curr.filter(x => x.id !== p.id)) }, msLeft)
    }).filter((t): t is ReturnType<typeof setTimeout> => t !== null)
    return () => { timers.forEach(clearTimeout) }
  }, [list])

  useEffect(() => {
    if (idx >= list.length && list.length > 0) setIdx(0)
  }, [list.length, idx])

  if (list.length === 0) return null
  const current = list[idx]
  const isMulti = list.length > 1

  return (
    <div className="space-y-2 animate-fade-in">
      <PropagandaCard prop={current} imgError={imgErrors.has(current.id)} onImgError={() => setImgErrors(s => new Set(s).add(current.id))} />
      {isMulti && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {list.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-primary' : 'w-1.5 bg-ink/20'}`}
              aria-label={`Comunicado ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tela ─────────────────────────────────────────────────────────────────────
export function HomeScreen() {
  const { session }                = useAuth()
  const { mqttPhase, agentOnline } = useMQTT()

  const hora         = new Date().getHours()
  const saudacao     = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = session?.nome.split(' ')[0] ?? 'Gestor'

  const robotVariant =
    mqttPhase === 'offline'      ? 'disconnected' :
    mqttPhase === 'connecting'   ? 'offline'      :
    mqttPhase === 'reconnecting' ? 'offline'      :
    agentOnline                  ? 'online'        :
                                   'offline'

  const statusLabel =
    mqttPhase === 'connecting'   ? 'Conectando…'                   :
    mqttPhase === 'reconnecting' ? 'Reconectando…'                 :
    mqttPhase === 'offline'      ? 'Sem conexão com o servidor'    :
    agentOnline                  ? 'Agente conectado'              :
                                   'Agente offline — modo cache'

  return (
    <div className="pt-2 space-y-5">
      <PropagandaBanner session={session} />

      {/* Saudação + clima + status */}
      <div>
        <p className="text-ink/50 text-sm">{saudacao},</p>
        <div className="flex items-center justify-between gap-3 mt-0.5">
          <h1 className="text-[28px] font-bold text-ink leading-tight">
            {primeiroNome} <span aria-hidden>👋</span>
          </h1>
          <WeatherInline />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <RobotIcon variant={robotVariant} size={20} />
          <span className="text-[13px] text-ink/60">{statusLabel}</span>
        </div>
      </div>

      {/* Warnings */}
      {mqttPhase === 'online' && !agentOnline && (
        <div className="bg-surface rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-ink/70 text-sm font-medium">Agente offline no posto</p>
            <p className="text-ink/40 text-xs">Dados em tempo real indisponíveis.</p>
          </div>
        </div>
      )}
      {mqttPhase === 'offline' && (
        <div className="bg-surface rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse flex-shrink-0" />
          <div>
            <p className="text-ink/70 text-sm font-medium">Sem conexão</p>
            <p className="text-ink/40 text-xs">Verifique sua internet.</p>
          </div>
        </div>
      )}

      {/* Placeholder pra conteúdo futuro */}
      <div className="bg-surface rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-rim/40 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Sparkles size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-ink font-semibold text-[15px]">Novidades em breve</p>
          <p className="text-ink/45 text-[12px] mt-1 max-w-xs">
            Acesse os recursos pelo menu inferior. Esta área receberá novos widgets em breve.
          </p>
        </div>
      </div>
    </div>
  )
}
