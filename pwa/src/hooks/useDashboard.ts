import { useEffect, useState, useCallback } from 'react'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { useAuth } from '@/core/auth/AuthContext'
import { useEmpresa } from '@/core/empresa/EmpresaContext'
import type { MQTTResponse } from '@/lib/contracts'

interface DashboardState {
  data: Record<string, unknown>[] | null
  loading: boolean
  cached: boolean
  error: string | null
  lastUpdate: Date | null
}

export function useDashboard(templateId: string) {
  const { publish, subscribe } = useMQTT()
  const { session } = useAuth()
  const { empresasIds } = useEmpresa()
  const [state, setState] = useState<DashboardState>({
    data: null, loading: true, cached: false, error: null, lastUpdate: null,
  })

  const fetch = useCallback((forceRefresh = false) => {
    if (!session) return
    setState(s => ({ ...s, loading: true, error: null }))

    const requestId = crypto.randomUUID()
    const cnpj = session.cnpj.replace(/\D/g, '')
    const responseTopic = `pwa/${cnpj}/response/${requestId}`

    const unsub = subscribe(responseTopic, (payload) => {
      const res: MQTTResponse = JSON.parse(payload)
      if (res.status === 'success' && res.data) {
        setState({ data: res.data, loading: false, cached: res.cached ?? false, error: null, lastUpdate: new Date() })
      } else {
        setState(s => ({ ...s, loading: false, error: res.error_message ?? 'Erro ao carregar dados' }))
      }
      unsub()
    })

    publish(`agent/${cnpj}/commands`, JSON.stringify({
      type: 'READ_QUERY',
      request_id: requestId,
      template_id: templateId,
      user_jwt: session.jwt,
      empresas_ids: empresasIds,
      force_refresh: forceRefresh,
      timestamp: Date.now(),
      response_topic: responseTopic,
    }))

    const timeout = setTimeout(() => {
      setState(s => s.loading ? { ...s, loading: false, error: 'Timeout — agente sem resposta' } : s)
      unsub()
    }, 10000)

    return () => { clearTimeout(timeout); unsub() }
  }, [templateId, empresasIds, session, publish, subscribe])

  useEffect(() => {
    const cleanup = fetch()
    return cleanup
  }, [fetch])

  return { ...state, refresh: () => fetch(true) }
}
