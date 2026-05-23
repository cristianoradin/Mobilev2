/**
 * useNotifications — hook que integra tudo:
 *  - Pede permissão ao carregar a sessão
 *  - Registra Web Push subscription no portal
 *  - Escuta tópico MQTT sga/{cnpj}/alert e exibe notificação local
 *  - Escuta status do agente e alerta se ficar offline
 */
import { useEffect, useRef } from 'react'
import { useAuth }  from '@/core/auth/AuthContext'
import { useMQTT }  from '@/core/mqtt/MQTTContext'
import {
  requestPermission, subscribePush, showLocal, buildAlert, hasPermission
} from './NotificationService'

export function useNotifications() {
  const { session }                     = useAuth()
  const { subscribe, cnpjPrefix, connected } = useMQTT()
  const agentWasOnline = useRef(false)
  const offlineTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 1. Pede permissão + registra Web Push quando usuário faz login ──────
  useEffect(() => {
    if (!session) return

    async function setup() {
      const perm = await requestPermission()
      if (perm !== 'granted') return
      await subscribePush(session!.cnpj)
    }

    setup()
  }, [session])

  // ── 2. Escuta tópico de alertas do agente ──────────────────────────────
  useEffect(() => {
    if (!cnpjPrefix) return

    const unsub = subscribe(`${cnpjPrefix}/alert`, (raw) => {
      try {
        const msg = JSON.parse(raw) as {
          type: string
          nivel?: number
          nome?: string
          bico?: number
          valor?: number
          desconto?: number
          combustivel?: string
          preco?: number
        }

        switch (msg.type) {
          case 'tank_critical':
            showLocal(buildAlert('tank_critical', { nome: msg.nome, nivel: msg.nivel }))
            break
          case 'discount_request':
            showLocal(buildAlert('discount_request', { bico: msg.bico, valor: msg.valor, desconto: msg.desconto }))
            break
          case 'price_changed':
            showLocal(buildAlert('price_changed', { combustivel: msg.combustivel, preco: msg.preco }))
            break
          default:
            showLocal(buildAlert('generic', { title: msg.type, body: raw }))
        }
      } catch { /* ignora parse error */ }
    })

    return unsub
  }, [cnpjPrefix, subscribe])

  // ── 3. Detecta agente offline via heartbeat (LWT) ─────────────────────
  useEffect(() => {
    if (!cnpjPrefix) return

    const unsub = subscribe(`${cnpjPrefix}/status`, (raw) => {
      try {
        const msg = JSON.parse(raw) as { status: string }

        if (msg.status === 'online') {
          agentWasOnline.current = true
          if (offlineTimer.current) {
            clearTimeout(offlineTimer.current)
            offlineTimer.current = null
          }
        } else if (msg.status === 'offline' && agentWasOnline.current) {
          // Aguarda 5s antes de notificar (evita falsos positivos durante reconexão)
          offlineTimer.current = setTimeout(() => {
            showLocal(buildAlert('agent_offline'))
          }, 5000)
        }
      } catch { /* ignora */ }
    })

    return () => {
      unsub()
      if (offlineTimer.current) clearTimeout(offlineTimer.current)
    }
  }, [cnpjPrefix, subscribe])

  // ── 4. Notifica quando MQTT desconecta após estar conectado ──────────
  const prevConnected = useRef(connected)
  useEffect(() => {
    if (prevConnected.current && !connected && agentWasOnline.current) {
      showLocal(buildAlert('agent_offline'))
    }
    prevConnected.current = connected
  }, [connected])

  return { hasPermission: hasPermission() }
}
