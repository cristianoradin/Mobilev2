/* SGA Petro Portal — Service Worker para Web Push de alertas */

self.addEventListener('install', (event) => {
  // Ativa o novo SW imediatamente, sem esperar abas antigas fecharem
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'SGA Petro', body: event.data.text() }
  }

  const title = payload.title || 'SGA Petro'
  const severidade = payload.severidade || 'warn'

  const options = {
    body:    payload.body  || '',
    icon:    payload.icon  || '/apple-touch-icon.png',
    badge:   payload.badge || '/apple-touch-icon.png',
    tag:     payload.tag,                  // mesma tag substitui notificação anterior
    data:    payload.data  || {},
    requireInteraction: severidade === 'critical',
    timestamp: Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/observabilidade'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
