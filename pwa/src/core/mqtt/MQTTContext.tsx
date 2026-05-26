import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import mqtt from 'mqtt'
type MqttClient = ReturnType<typeof mqtt.connect>
import { useAuth } from '@/core/auth/AuthContext'

type MessageHandler = (payload: string) => void

/** Fase do ciclo de vida da conexão MQTT — usada pra mensagens UX contextuais. */
export type MqttPhase = 'connecting' | 'online' | 'reconnecting' | 'offline'

export interface MQTTContextValue {
  publish: (topic: string, payload: string) => void
  subscribe: (topic: string, handler: MessageHandler) => () => void
  /** true quando o PWA está conectado ao broker EMQX (compat) */
  connected: boolean
  /** Estado granular pra UX — distingue "conectando" / "reconectando" / "offline real" */
  mqttPhase: MqttPhase
  /** true quando recebemos status "online" do agente local (via retained message) */
  agentOnline: boolean
  cnpjPrefix: string
}

const MQTTContext = createContext<MQTTContextValue | null>(null)

const BROKER_URL = import.meta.env.VITE_MQTT_BROKER ?? 'ws://localhost:8083/mqtt'

/** Remove pontuação do CNPJ para uso em tópicos MQTT */
function cleanCnpj(cnpj: string) {
  return cnpj.replace(/\D/g, '')
}

export function MQTTProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const clientRef   = useRef<MqttClient | null>(null)
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map())
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const agentStaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mqttPhase,   setMqttPhase]   = useState<MqttPhase>('connecting')
  const [agentOnline, setAgentOnline] = useState(false)

  const connected  = mqttPhase === 'online'
  const cnpjPrefix = session ? `sga/${cleanCnpj(session.cnpj)}` : ''

  useEffect(() => {
    if (!session) return

    const cnpj = cleanCnpj(session.cnpj)
    setMqttPhase('connecting')

    const client = mqtt.connect(BROKER_URL, {
      clientId:       `pwa-${cnpj}-${Date.now()}`,
      username:       cnpj,
      password:       session.jwt,
      keepalive:      30,
      reconnectPeriod: 3000,
      clean:          true,
    })

    client.on('connect', () => {
      // Cancela timer de "vira offline real após X" — voltou
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      setMqttPhase('online')
      client.subscribe([
        `sga/${cnpj}/result`,
        `sga/${cnpj}/status`,   // retained → entrega imediata do estado atual
      ])
    })

    // ✱ FIX BUG #4: NÃO derruba `connected` nem `agentOnline` imediato.
    // Marca como 'reconnecting'. Só vira 'offline' real após 8s sem voltar.
    // Mantém último agentOnline conhecido — não pisca "offline" no resume.
    const scheduleOfflineCheck = () => {
      if (reconnectTimerRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        setMqttPhase('offline')
        setAgentOnline(false)
        reconnectTimerRef.current = null
      }, 8000)
    }

    client.on('offline',   () => { setMqttPhase(p => p === 'online' ? 'reconnecting' : p); scheduleOfflineCheck() })
    client.on('reconnect', () => { setMqttPhase(p => p === 'online' ? 'reconnecting' : p); scheduleOfflineCheck() })
    client.on('error',     () => { setMqttPhase(p => p === 'online' ? 'reconnecting' : p); scheduleOfflineCheck() })

    client.on('message', (topic, payload) => {
      const raw = payload.toString()

      if (topic === `sga/${cnpj}/status`) {
        try {
          const msg = JSON.parse(raw) as { status: string }
          setAgentOnline(msg.status === 'online')
          // Reset stale-timer: status recente confirma vivo
          if (agentStaleTimerRef.current) clearTimeout(agentStaleTimerRef.current)
          agentStaleTimerRef.current = setTimeout(() => setAgentOnline(false), 90_000)
        } catch { /* payload malformado */ }
      }

      handlersRef.current.get(topic)?.forEach(h => h(raw))
    })

    clientRef.current = client
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (agentStaleTimerRef.current) clearTimeout(agentStaleTimerRef.current)
      client.end(true)
      setMqttPhase('offline')
      setAgentOnline(false)
    }
  }, [session])

  const publish = useCallback((topic: string, payload: string) => {
    clientRef.current?.publish(topic, payload, { qos: 1 })
  }, [])

  const subscribe = useCallback((topic: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(topic)) {
      handlersRef.current.set(topic, new Set())
      if (!topic.endsWith('/result') && !topic.endsWith('/status')) {
        clientRef.current?.subscribe(topic)
      }
    }
    handlersRef.current.get(topic)!.add(handler)

    return () => {
      handlersRef.current.get(topic)?.delete(handler)
      if (handlersRef.current.get(topic)?.size === 0) {
        handlersRef.current.delete(topic)
      }
    }
  }, [])

  return (
    <MQTTContext.Provider value={{ publish, subscribe, connected, mqttPhase, agentOnline, cnpjPrefix }}>
      {children}
    </MQTTContext.Provider>
  )
}

export function useMQTT() {
  const ctx = useContext(MQTTContext)
  if (!ctx) throw new Error('useMQTT must be inside MQTTProvider')
  return ctx
}
