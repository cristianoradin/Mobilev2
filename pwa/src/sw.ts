/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

// ── Ativa imediatamente sem esperar tabs fecharem ──────────────────────────
// Essencial para PWA salvo na tela inicial: garante que updates chegam rápido
self.skipWaiting()
clientsClaim()

// ── Workbox precaching ─────────────────────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Responde mensagem de skip waiting (enviada pelo registerSW) ────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Push event: recebe notificação do servidor (Web Push) ──────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    data?: Record<string, unknown>
  }

  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'SGA Petro', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:   payload.body,
      icon:   payload.icon  ?? '/icons/icon-192.png',
      badge:  payload.badge ?? '/icons/icon-192.png',
      tag:    payload.tag   ?? 'sga-alert',
      data:   payload.data,
      // vibrate não está nos tipos TS mas é suportado por browsers mobile
      ...({ vibrate: [200, 100, 200] } as object),
      requireInteraction: payload.data?.['priority'] === 'high',
    } as NotificationOptions)
  )
})

// ── Notification click: abre o app na rota correta ──────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const route = (event.notification.data?.['route'] as string | undefined) ?? '/'
  const urlToOpen = new URL(route, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Se o app já está aberto, foca e navega
        const existing = clients.find(c => c.url.startsWith(self.location.origin))
        if (existing) {
          existing.focus()
          existing.postMessage({ type: 'NAVIGATE', route })
          return
        }
        // Senão, abre nova janela
        return self.clients.openWindow(urlToOpen)
      })
  )
})
