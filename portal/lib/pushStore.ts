/**
 * pushStore.ts — armazena subscriptions Web Push no PostgreSQL.
 * Cada subscription é identificada pelo endpoint (UNIQUE) e associada a um cnpj.
 */
import { getDb } from '@/lib/db'
import type { PushSubscription } from 'web-push'

/** Adiciona ou atualiza subscription para um cnpj */
export async function addSubscription(cnpj: string, sub: PushSubscription): Promise<void> {
  const sql = getDb()
  const keys = sub.keys as { p256dh: string; auth: string }
  await sql`
    INSERT INTO push_subscriptions (cnpj, endpoint, p256dh, auth_key)
    VALUES (${cnpj}, ${sub.endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET cnpj     = EXCLUDED.cnpj,
          p256dh   = EXCLUDED.p256dh,
          auth_key = EXCLUDED.auth_key
  `
}

/** Retorna todas as subscriptions de um cnpj */
export async function getSubscriptions(cnpj: string): Promise<PushSubscription[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE cnpj = ${cnpj}
  `
  return rows.map(r => ({
    endpoint: String(r.endpoint),
    keys: { p256dh: String(r.p256dh), auth: String(r.authKey) },
  })) as PushSubscription[]
}

/** Retorna subscriptions de todos os cnpjs */
export async function getAllSubscriptions(): Promise<Array<{ cnpj: string; sub: PushSubscription }>> {
  const sql = getDb()
  const rows = await sql`SELECT cnpj, endpoint, p256dh, auth_key FROM push_subscriptions`
  return rows.map(r => ({
    cnpj: String(r.cnpj),
    sub: {
      endpoint: String(r.endpoint),
      keys: { p256dh: String(r.p256dh), auth: String(r.authKey) },
    } as PushSubscription,
  }))
}

/** Remove uma subscription pelo endpoint (após 410/404 do servidor push) */
export async function removeSubscription(cnpj: string, endpoint: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM push_subscriptions WHERE cnpj = ${cnpj} AND endpoint = ${endpoint}`
}
