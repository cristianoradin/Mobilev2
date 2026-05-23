import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import mqtt from 'mqtt'
type MqttClient = ReturnType<typeof mqtt.connect>
import { useAuth } from '@/core/auth/AuthContext'

type MessageHandler = (payload: string) => void

export interface MQTTContextValue {
  /** Publica em qualquer tópico */
  publish: (topic: string, payload: string) => void
  /** Assina um tópico; retorna função de cleanup */
  subscribe: (topic: string, handler: MessageHandler) => () => void
  /** true quando conectado ao EMQX */
  connected: boolean
  /** Helper: retorna o prefixo de tópico do cliente, ex: "sga/12345678000199" */
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
  const [connected, setConnected] = useState(false)

  const cnpjPrefix = session ? `sga/${cleanCnpj(session.cnpj)}` : ''

  useEffect(() => {
    if (!session) return

    const cnpj = cleanCnpj(session.cnpj)

    const client = mqtt.connect(BROKER_URL, {
      clientId:       `pwa-${cnpj}-${Date.now()}`,
      username:       session.email,   // EMQX identifica pelo JWT em password
      password:       session.jwt,
      keepalive:      30,
      reconnectPeriod: 3000,
      clean:          true,
    })

    client.on('connect', () => {
      setConnected(true)
      // Assina tópicos permanentes do cliente
      client.subscribe([
        `sga/${cnpj}/result`,
        `sga/${cnpj}/status`,
      ])
    })
    client.on('offline',       () => setConnected(false))
    client.on('error',         () => setConnected(false))
    client.on('reconnect',     () => setConnected(false))

    client.on('message', (topic, payload) => {
      const raw = payload.toString()
      handlersRef.current.get(topic)?.forEach(h => h(raw))
    })

    clientRef.current = client
    return () => { client.end(true); setConnected(false) }
  }, [session])

  const publish = useCallback((topic: string, payload: string) => {
    clientRef.current?.publish(topic, payload, { qos: 1 })
  }, [])

  const subscribe = useCallback((topic: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(topic)) {
      handlersRef.current.set(topic, new Set())
      // Só faz subscribe MQTT se ainda não estava na lista permanente
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
    <MQTTContext.Provider value={{ publish, subscribe, connected, cnpjPrefix }}>
      {children}
    </MQTTContext.Provider>
  )
}

export function useMQTT() {
  const ctx = useContext(MQTTContext)
  if (!ctx) throw new Error('useMQTT must be inside MQTTProvider')
  return ctx
}
