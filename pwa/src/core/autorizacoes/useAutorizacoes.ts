/**
 * useAutorizacoes — gerencia solicitações de desconto em tempo real via MQTT.
 *
 * Tópicos MQTT:
 *  {cnpjPrefix}/autorizacoes  ← agente publica DescontoRequest quando PDV solicita desconto
 *  {cnpjPrefix}/command       → PWA publica DESCONTO_RESPONSE (via useCommand)
 *  {cnpjPrefix}/result        ← agente confirma resultado do DESCONTO_RESPONSE
 */
import { useState, useEffect, useCallback } from 'react'
import { useMQTT }   from '@/core/mqtt/MQTTContext'
import { useCommand } from '@/hooks/useCommand'
import type { DescontoRequest } from '@/lib/contracts'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface Solicitacao {
  id:                  string
  bico:                number
  litros:              number
  valor_total:         number
  desconto_solicitado: number
  operador:            string   // nome se disponível, senão operador_id
  timestamp:           number
  status:              'pendente' | 'aprovado' | 'rejeitado'
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAutorizacoes() {
  const { subscribe, cnpjPrefix } = useMQTT()
  const { send, loading: cmdLoading } = useCommand()

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [processando,  setProcessando]  = useState<string | null>(null)

  // ── Escuta tópico de requisições de desconto ───────────────────────────────
  useEffect(() => {
    if (!cnpjPrefix) return

    const unsub = subscribe(`${cnpjPrefix}/autorizacoes`, (raw) => {
      try {
        const req = JSON.parse(raw) as DescontoRequest
        if (req.type !== 'DESCONTO_REQUEST') return

        setSolicitacoes(prev => {
          // Ignora duplicatas (ex: reconexão MQTT que re-entrega mensagens retidas)
          if (prev.some(s => s.id === req.notification_id)) return prev

          const nova: Solicitacao = {
            id:                  req.notification_id,
            bico:                req.bico,
            litros:              req.litros,
            valor_total:         req.valor_total,
            desconto_solicitado: req.desconto_solicitado,
            operador:            req.operador_nome ?? req.operador_id,
            timestamp:           req.timestamp,
            status:              'pendente',
          }
          // Mais recentes no topo
          return [nova, ...prev]
        })
      } catch {
        // Ignora mensagens malformadas
      }
    })

    return unsub
  }, [cnpjPrefix, subscribe])

  // ── Aprovar / Rejeitar ─────────────────────────────────────────────────────
  const responder = useCallback(async (
    sol: Solicitacao,
    aprovado: boolean
  ): Promise<boolean> => {
    setProcessando(sol.id)

    const ok = await send('DESCONTO_RESPONSE', {
      notification_id: sol.id,
      aprovado,
      observacao: aprovado ? 'Autorizado via PWA' : 'Rejeitado via PWA',
    })

    if (ok) {
      setSolicitacoes(prev =>
        prev.map(s =>
          s.id === sol.id
            ? { ...s, status: aprovado ? 'aprovado' : 'rejeitado' }
            : s
        )
      )
    }

    setProcessando(null)
    return ok
  }, [send])

  // ── Utilitários ────────────────────────────────────────────────────────────
  const pendentes  = solicitacoes.filter(s => s.status === 'pendente')
  const historico  = solicitacoes.filter(s => s.status !== 'pendente')

  return { solicitacoes, pendentes, historico, processando, cmdLoading, responder }
}
