import { useState } from 'react'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { useAuth } from '@/core/auth/AuthContext'
import type { MQTTWriteCommand, MQTTResponse } from '@/lib/contracts'

interface CommandState {
  loading: boolean
  success: boolean
  error: string | null
}

export function useCommand() {
  const { publish, subscribe, cnpjPrefix } = useMQTT()
  const { session } = useAuth()
  const [state, setState] = useState<CommandState>({ loading: false, success: false, error: null })

  async function send(
    subtype: MQTTWriteCommand['subtype'],
    payload: Record<string, unknown>
  ): Promise<boolean> {
    if (!session || !cnpjPrefix) return false

    setState({ loading: true, success: false, error: null })
    const requestId = crypto.randomUUID()

    return new Promise((resolve) => {
      // Escuta o tópico compartilhado de resultado, filtrando pelo request_id
      const unsub = subscribe(`${cnpjPrefix}/result`, (raw) => {
        try {
          const res: MQTTResponse = JSON.parse(raw)
          if (res.request_id !== requestId) return
          unsub()
          if (res.status === 'success') {
            setState({ loading: false, success: true, error: null })
            resolve(true)
          } else {
            setState({ loading: false, success: false, error: res.error_message ?? 'Comando negado' })
            resolve(false)
          }
        } catch { /* ignora parse error */ }
      })

      // Publica no tópico de comando (sga/{cnpj}/command)
      publish(`${cnpjPrefix}/command`, JSON.stringify({
        type:         'WRITE_COMMAND',
        subtype,
        request_id:   requestId,
        user_jwt:     session.jwt,
        empresas_ids: [],
        payload,
        timestamp:    Date.now(),
      } satisfies MQTTWriteCommand))

      setTimeout(() => {
        setState({ loading: false, success: false, error: 'Timeout — agente sem resposta' })
        resolve(false)
        unsub()
      }, 15_000)
    })
  }

  function reset() {
    setState({ loading: false, success: false, error: null })
  }

  return { ...state, send, reset }
}
