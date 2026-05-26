/**
 * adminPushStore.ts — CRUD de subscriptions Web Push de admins do portal.
 * Diferente de pushStore.ts (que guarda subs de usuários PWA por CNPJ).
 */
import { getDb } from '@/lib/db'
import type { PushSubscription } from 'web-push'

export interface StoredAdminSub {
  id:       number
  adminId:  string
  endpoint: string
  sub:      PushSubscription
}

/** Insere ou atualiza subscription do admin */
export async function upsertAdminSubscription(
  adminId:   string,
  sub:       PushSubscription,
  userAgent: string | null,
): Promise<void> {
  const sql  = getDb()
  const keys = sub.keys as { p256dh: string; auth: string }
  await sql`
    INSERT INTO admin_push_subscriptions (admin_id, endpoint, p256dh, auth_key, user_agent)
    VALUES (${adminId}, ${sub.endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent ?? null})
    ON CONFLICT (endpoint) DO UPDATE
      SET admin_id   = EXCLUDED.admin_id,
          p256dh     = EXCLUDED.p256dh,
          auth_key   = EXCLUDED.auth_key,
          user_agent = EXCLUDED.user_agent
  `
}

/** Remove subscription pelo endpoint */
export async function removeAdminSubscription(endpoint: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM admin_push_subscriptions WHERE endpoint = ${endpoint}`
}

/** Retorna se existe pelo menos uma subscription ativa para este endpoint */
export async function hasAdminSubscription(endpoint: string): Promise<boolean> {
  const sql = getDb()
  const [row] = await sql`
    SELECT 1 FROM admin_push_subscriptions WHERE endpoint = ${endpoint} LIMIT 1
  `
  return !!row
}

/** Lista todas as subscriptions de admin (usado pelo delivery) */
export async function getAllAdminSubscriptions(): Promise<StoredAdminSub[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, admin_id, endpoint, p256dh, auth_key
    FROM admin_push_subscriptions
  `
  return rows.map(r => ({
    id:       Number(r.id),
    adminId:  String(r.adminId),
    endpoint: String(r.endpoint),
    sub: {
      endpoint: String(r.endpoint),
      keys: { p256dh: String(r.p256dh), auth: String(r.authKey) },
    } as PushSubscription,
  }))
}

/** Atualiza ultimo_uso (chamado após envio bem-sucedido) */
export async function touchAdminSubscription(id: number): Promise<void> {
  const sql = getDb()
  await sql`UPDATE admin_push_subscriptions SET ultimo_uso = NOW() WHERE id = ${id}`
}
