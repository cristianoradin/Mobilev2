/**
 * syncTemplate.ts
 *
 * Publica SYNC_TEMPLATE (retained, QoS 1) para todos os agentes cujos
 * clientes têm o template liberado. Chamado sempre que um template é
 * salvo ou sua liberação é alterada.
 *
 * O agente Go ao subscrever em sga/{cnpj}/config recebe a mensagem
 * retained imediatamente e grava o template em seu cache SQLite local.
 * Isso elimina o erro "template não encontrado — sincronize via portal".
 *
 * ⚠️  Problema "last wins": como o broker só retém UMA mensagem por tópico,
 *     publicar múltiplos templates sobrescreve o retain. Para garantir que
 *     o agente receba TODOS os templates ao reconectar, usamos dois mecanismos:
 *     1. `syncAllTemplatesToAgent` publica todos (sem retain) quando o agente
 *        faz heartbeat depois de estar offline (chamado em agent/heartbeat).
 *     2. O retain continua sendo publicado para o último template salvo,
 *        servindo de fallback para o caso de o agente reconectar sem heartbeat.
 */
import { randomUUID }           from 'crypto'
import { getDb }                from '@/lib/db'
import { publishMqtt, publishMqttBroadcast } from '@/lib/mqttpublish'
import { getGraficosByCliente } from '@/lib/repositories/graficos'
import type { ChartMetadata }   from '@/lib/types'

// ── Utilitário interno ────────────────────────────────────────────────────────

function buildSyncPayload(meta: ChartMetadata, retain = false) {
  const perm = meta.permissions as Record<string, unknown>
  const normalizedMeta = {
    ...meta,
    permissions: {
      min_role: (perm['min_role'] ?? perm['minRole'] ?? 'operador') as string,
    },
  }
  return {
    payload: {
      type:        'SYNC_TEMPLATE',
      request_id:  `sync-${randomUUID()}`,
      template_id: meta.id,
      payload:     normalizedMeta,
      timestamp:   Date.now(),
    },
    retain,
  }
}

// ── Exportações públicas ──────────────────────────────────────────────────────

/**
 * Sincroniza `meta` para os agentes de todos os clientes afetados.
 * Chamado quando um template é salvo ou sua liberação é alterada.
 */
export async function syncTemplateToAgents(
  meta:       ChartMetadata,
  isPublico:  boolean,
  clienteIds: string[],
): Promise<void> {
  try {
    if (!isPublico && clienteIds.length === 0) return

    const db = getDb()

    const rows = isPublico
      ? await db`SELECT cnpj FROM clientes WHERE ativo = true`
      : await db`
          SELECT cnpj FROM clientes
          WHERE  id = ANY(${clienteIds}::uuid[])
            AND  ativo = true
        `

    if (!rows.length) return

    const cnpjs  = rows.map(r => String(r.cnpj).replace(/[.\-/]/g, ''))
    const topics = cnpjs.map(cnpj => `sga/${cnpj}/config`)

    const { payload: syncPayload } = buildSyncPayload(meta)

    // retain=true → agente recebe ao reconectar mesmo que esteja offline agora
    const { ok, failed } = await publishMqttBroadcast(topics, syncPayload, { retain: true })

    console.log(
      `[syncTemplate] "${meta.nome}" (${meta.id}) → ${ok} agente(s) OK, ${failed} falha(s)`,
    )
  } catch (err) {
    console.error('[syncTemplate] Erro ao sincronizar template:', err)
  }
}

/**
 * Re-sincroniza TODOS os templates de um cliente para o seu agente.
 * Chamado no heartbeat quando o agente acabou de reconectar (estava offline).
 *
 * Publica cada template sem retain (agente está online agora) e republica
 * o último COM retain, para servir de fallback em futuras reconexões.
 */
export async function syncAllTemplatesToAgent(
  clienteId: string,
  cnpj:      string,
): Promise<void> {
  try {
    const cnpjClean = cnpj.replace(/[.\-/]/g, '')
    const topic     = `sga/${cnpjClean}/config`

    const templates = await getGraficosByCliente(clienteId)
    if (!templates.length) return

    for (let i = 0; i < templates.length; i++) {
      const meta   = templates[i]
      const isLast = i === templates.length - 1

      const perm = meta.permissions as Record<string, unknown>
      const normalizedMeta = {
        ...meta,
        permissions: {
          min_role: (perm['min_role'] ?? perm['minRole'] ?? 'operador') as string,
        },
      }

      const syncPayload = {
        type:        'SYNC_TEMPLATE',
        request_id:  `sync-${randomUUID()}`,
        template_id: meta.id,
        payload:     normalizedMeta,
        timestamp:   Date.now(),
      }

      // Último template → retain=true (fallback para próxima reconexão)
      await publishMqtt(topic, syncPayload, { retain: isLast })

      // Pequena pausa para o agente processar em sequência
      if (!isLast) await new Promise(r => setTimeout(r, 150))
    }

    console.log(
      `[syncTemplate] Re-sync completo para ${cnpjClean}: ${templates.length} template(s)`,
    )
  } catch (err) {
    console.error('[syncTemplate] Erro no re-sync por heartbeat:', err)
  }
}
