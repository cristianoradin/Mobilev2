/**
 * webpush.ts — utilitário servidor para envio de Web Push via VAPID.
 *
 * Usa a biblioteca `web-push` com as chaves VAPID definidas nas variáveis de ambiente:
 *   VAPID_PUBLIC_KEY   — chave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY  — chave privada VAPID (base64url)
 *   VAPID_CONTACT      — mailto: ou URL do responsável
 */
import webpush from 'web-push'
import type { PushSubscription } from 'web-push'

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_CONTACT     = process.env.VAPID_CONTACT     ?? 'mailto:admin@sgapetro.cloud'

// Configura uma vez na inicialização do módulo
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} else {
  console.warn('[WebPush] VAPID keys não configuradas — notificações push desativadas')
}

export type PushPayload = {
  title:    string
  body:     string
  icon?:    string
  badge?:   string
  tag?:     string
  data?:    Record<string, unknown>
}

/**
 * Envia uma notificação push para uma subscription específica.
 * Retorna true em caso de sucesso, false se a subscription expirou/inválida.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (err: unknown) {
    // StatusCode 410 = subscription expirada/cancelada (deve ser removida)
    const code = (err as { statusCode?: number }).statusCode
    if (code === 410 || code === 404) {
      return false  // sinaliza para remover da lista
    }
    console.error('[WebPush] Falha ao enviar:', err)
    return false
  }
}
