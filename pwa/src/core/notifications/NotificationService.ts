/**
 * NotificationService — centraliza permissão, Web Push e exibição de notificações.
 *
 * Fluxo:
 *  1. requestPermission() — pede permissão ao usuário (uma vez)
 *  2. subscribePush()     — registra com o servidor de push (VAPID)
 *  3. sendSubscription()  — envia subscription ao portal para armazenamento
 *  4. showLocal()         — exibe notificação local imediatamente (MQTT foreground)
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
const API_URL          = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001') as string

export type AlertType =
  | 'tank_critical'
  | 'discount_request'
  | 'agent_offline'
  | 'price_changed'
  | 'generic'

export interface AlertPayload {
  type:      AlertType
  title:     string
  body:      string
  route?:    string           // rota do app a abrir ao clicar
  priority?: 'normal' | 'high'
  data?:     Record<string, unknown>
}

// ── Permissão ──────────────────────────────────────────────────────────────
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function hasPermission(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

// ── Notificação local (imediata, via Service Worker se disponível) ──────────
export async function showLocal(alert: AlertPayload): Promise<void> {
  if (!hasPermission()) return

  // 'vibrate' não está nos tipos TS mas é suportado pelo browser — cast necessário
  const options = {
    body:    alert.body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     alert.type,
    data:    { route: alert.route ?? '/', ...alert.data },
    vibrate: [200, 100, 200],
    requireInteraction: alert.priority === 'high',
  } as NotificationOptions

  // Prefere Service Worker (funciona com app em background)
  const reg = await getRegistration()
  if (reg) {
    await reg.showNotification(alert.title, options)
  } else {
    new Notification(alert.title, options)
  }
}

// ── Web Push subscription ──────────────────────────────────────────────────
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.ready) ?? null
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

export async function subscribePush(cnpj: string): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY não configurado')
    return null
  }

  const reg = await getRegistration()
  if (!reg) return null

  try {
    // Reutiliza subscription existente se houver
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await sendSubscriptionToPortal(existing, cnpj)
      return existing
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await sendSubscriptionToPortal(sub, cnpj)
    return sub
  } catch (err) {
    console.error('[Push] Erro ao subscrever:', err)
    return null
  }
}

async function sendSubscriptionToPortal(sub: PushSubscription, cnpj: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/push/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription: sub.toJSON(), cnpj }),
    })
  } catch (err) {
    console.warn('[Push] Falha ao enviar subscription ao portal:', err)
  }
}

// ── Mapeamento de tipo para ícone/rota ────────────────────────────────────
export function buildAlert(type: AlertType, data: Record<string, unknown> = {}): AlertPayload {
  const map: Record<AlertType, Omit<AlertPayload, 'type'>> = {
    tank_critical: {
      title:    '⚠️ Tanque em Nível Crítico',
      body:     `${data['nome'] ?? 'Tanque'} está em ${data['nivel'] ?? '?'}% — solicite reabastecimento`,
      route:    '/estoque',
      priority: 'high',
    },
    discount_request: {
      title:    '🔔 Autorização de Desconto',
      body:     `Bico ${data['bico'] ?? '?'} — R$ ${data['valor'] ?? '?'} — desconto ${data['desconto'] ?? '?'}%`,
      route:    '/autorizacoes',
      priority: 'high',
    },
    agent_offline: {
      title:    '📡 Agente Desconectado',
      body:     'A conexão com o posto foi perdida. Verifique a rede local.',
      route:    '/',
      priority: 'normal',
    },
    price_changed: {
      title:    '✅ Preço Atualizado',
      body:     `${data['combustivel'] ?? 'Combustível'}: R$ ${data['preco'] ?? '?'}/L`,
      route:    '/troca-preco',
      priority: 'normal',
    },
    generic: {
      title:    data['title'] as string ?? 'SGA Petro',
      body:     data['body']  as string ?? '',
      route:    '/',
      priority: 'normal',
    },
  }

  return { type, ...map[type], data }
}
