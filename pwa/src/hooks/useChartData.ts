/**
 * useChartData — busca dados de um template via MQTT e gerencia o ciclo de vida:
 *   1. Publica READ_QUERY em sga/{cnpj}/query
 *   2. Aguarda resposta em sga/{cnpj}/result filtrando pelo request_id
 *   3. Auto-refresh baseado em metadata.query.refresh_seconds
 *   4. Fallback stale: se o agente não responder, mantém os últimos dados
 */
import { useEffect, useState, useCallback } from 'react'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { useAuth } from '@/core/auth/AuthContext'
import { useEmpresa } from '@/core/empresa/EmpresaContext'
import type { MQTTResponse, ChartMetadata } from '@/lib/contracts'

const QUERY_TIMEOUT_MS = 12_000

export interface ChartDataState {
  data:        Record<string, unknown>[] | null
  loading:     boolean
  error:       string | null
  cached:      boolean
  stale:       boolean          // dados antigos servidos como fallback
  lastUpdate:  Date | null
  agentOnline: boolean
  refresh:     (force?: boolean) => void
}

interface UseChartDataOpts {
  /** YYYY-MM-DD — substitui :data_inicio no SQL via agente */
  dateFrom?: string
  /** YYYY-MM-DD */
  dateTo?:   string
}

export function useChartData(metadata: ChartMetadata, opts: UseChartDataOpts = {}): ChartDataState {
  const { publish, subscribe, cnpjPrefix, connected, agentOnline } = useMQTT()
  const { session }     = useAuth()
  const { empresasIds } = useEmpresa()
  const { dateFrom, dateTo } = opts

  const [data,       setData]       = useState<Record<string, unknown>[] | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [cached,     setCached]     = useState(false)
  const [stale,      setStale]      = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // agentOnline vem do MQTTContext global (retained message do agente)

  const fetch = useCallback((forceRefresh = false) => {
    if (!session || !cnpjPrefix || !connected) {
      setLoading(false)
      setError(connected ? null : 'Aguardando conexão com o agente...')
      return
    }

    setLoading(true)
    setError(null)

    const requestId = crypto.randomUUID()
    const resultTopic = `${cnpjPrefix}/result`

    let done = false

    const unsub = subscribe(resultTopic, (raw) => {
      try {
        const res: MQTTResponse = JSON.parse(raw)
        if (res.request_id !== requestId) return   // mensagem de outro request
        done = true
        unsub()

        if (res.status === 'success') {
          // data pode ser null quando a query retorna 0 linhas — normaliza para []
          setData(res.data ?? [])
          setCached(res.cached ?? false)
          setStale(false)
          setLastUpdate(new Date())
          setError(null)
        } else {
          setError(res.error_message ?? 'Erro ao carregar dados')
          // mantém dados anteriores como stale
          if (data) setStale(true)
        }
      } catch {
        setError('Resposta inválida do agente')
      } finally {
        setLoading(false)
      }
    })

    publish(`${cnpjPrefix}/query`, JSON.stringify({
      type:          'READ_QUERY',
      request_id:    requestId,
      template_id:   metadata.id,
      user_jwt:      session.jwt,
      empresas_ids:  empresasIds,
      force_refresh: forceRefresh,
      timestamp:     Date.now(),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo   ? { date_to:   dateTo   } : {}),
    }))

    // Timeout: serve dados stale se existirem, senão mostra erro
    const timer = setTimeout(() => {
      if (done) return
      unsub()
      setLoading(false)
      if (data) {
        setStale(true)
        setError(null)
      } else {
        setError('Agente sem resposta — verifique a conexão')
      }
    }, QUERY_TIMEOUT_MS)

    return () => { clearTimeout(timer); unsub() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.id, empresasIds, session, cnpjPrefix, connected, publish, subscribe, dateFrom, dateTo])

  // Busca inicial
  useEffect(() => {
    const cleanup = fetch()
    return cleanup
  }, [fetch])

  // Auto-refresh
  useEffect(() => {
    const interval = metadata.query.refresh_seconds * 1000
    if (interval <= 0) return
    const id = setInterval(() => fetch(), interval)
    return () => clearInterval(id)
  }, [metadata.query.refresh_seconds, fetch])

  return {
    data,
    loading,
    error,
    cached,
    stale,
    lastUpdate,
    agentOnline,
    refresh: fetch,
  }
}
