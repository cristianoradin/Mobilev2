'use client'
/**
 * Botão para o admin habilitar/desabilitar notificações push do portal.
 * Estados:
 *   - unsupported: navegador sem Notification/PushManager/ServiceWorker
 *   - denied:      permissão negada (precisa habilitar nas configurações do browser)
 *   - off:         suportado mas não inscrito
 *   - on:          inscrito (mostra "Notificações: ON")
 *   - loading/busy: em transição
 */
import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on' | 'busy'

// Converte VAPID public key (base64url) em Uint8Array para PushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  const out     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export function AdminPushButton({ className }: { className?: string }) {
  const [state, setState] = useState<State>('loading')

  // Carrega estado inicial: SW registrado? subscription existe? bate com servidor?
  const init = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return
    }
    if (Notification.permission === 'denied') {
      setState('denied'); return
    }

    try {
      // Garante que o SW está registrado (idempotente)
      await navigator.serviceWorker.register('/sw.js')
      const sub = await getCurrentSubscription()
      if (!sub) { setState('off'); return }

      // Confirma com o servidor que essa subscription está registrada lá
      const r = await fetch(`/api/admin/push?endpoint=${encodeURIComponent(sub.endpoint)}`)
      const j = r.ok ? await r.json() : { subscribed: false }
      setState(j.subscribed ? 'on' : 'off')
    } catch (err) {
      console.error('[AdminPushButton] init:', err)
      setState('off')
    }
  }, [])

  useEffect(() => { init() }, [init])

  const enable = useCallback(async () => {
    setState('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return }

      // Pega VAPID key do servidor
      const meta = await fetch('/api/admin/push').then(r => r.json())
      if (!meta.available || !meta.vapidPublicKey) {
        alert('Push não disponível no servidor (VAPID não configurado)')
        setState('off'); return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      // Aguarda SW ficar ativo (necessário em primeira instalação)
      if (reg.installing) await new Promise<void>(resolve => {
        const sw = reg.installing!
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve()
        })
      })

      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // cast: tipos atualizados do TS exigem Uint8Array<ArrayBuffer>; aqui o buffer é local
        applicationServerKey: urlBase64ToUint8Array(meta.vapidPublicKey) as unknown as BufferSource,
      })

      const r = await fetch('/api/admin/push', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent:    navigator.userAgent,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setState('on')
    } catch (err) {
      console.error('[AdminPushButton] enable:', err)
      alert('Falha ao habilitar notificações. Veja o console.')
      setState('off')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('busy')
    try {
      const sub = await getCurrentSubscription()
      if (sub) {
        await fetch('/api/admin/push', {
          method:  'DELETE',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('off')
    } catch (err) {
      console.error('[AdminPushButton] disable:', err)
      setState('on') // mantém ON se falhou
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition'

  if (state === 'loading' || state === 'busy') {
    return (
      <span className={cn(base, 'bg-white/5 text-white/40', className)}>
        <Loader2 size={13} className="animate-spin" />
        {state === 'loading' ? 'Notificações' : 'Aguarde…'}
      </span>
    )
  }
  if (state === 'unsupported') {
    return (
      <span className={cn(base, 'bg-white/5 text-white/30', className)} title="Este navegador não suporta Web Push">
        <BellOff size={13} />
        Sem suporte
      </span>
    )
  }
  if (state === 'denied') {
    return (
      <span
        className={cn(base, 'bg-red-500/10 text-red-400', className)}
        title="Permissão negada — habilite nas configurações do navegador"
      >
        <BellOff size={13} />
        Bloqueado
      </span>
    )
  }
  if (state === 'on') {
    return (
      <button
        onClick={disable}
        className={cn(base, 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15', className)}
        title="Notificações ativas — clique para desativar neste navegador"
      >
        <BellRing size={13} />
        Notificações: ON
      </button>
    )
  }
  return (
    <button
      onClick={enable}
      className={cn(base, 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80', className)}
      title="Receber alertas mesmo com o portal fechado"
    >
      <Bell size={13} />
      Ativar notificações
    </button>
  )
}
