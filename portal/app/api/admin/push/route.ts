/**
 * Admin Web Push subscriptions.
 *
 * GET    — { subscribed, vapidPublicKey } — usado pela UI para inicializar
 * POST   — body: { subscription, userAgent? } — registra
 * DELETE — body: { endpoint } — remove
 *
 * Todas as rotas exigem sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import {
  upsertAdminSubscription,
  removeAdminSubscription,
  hasAdminSubscription,
} from '@/lib/adminPushStore'

export const dynamic = 'force-dynamic'

async function getSession() {
  const jar   = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  return token ? await verifySessionToken(token) : null
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const endpoint = req.nextUrl.searchParams.get('endpoint')
  const subscribed = endpoint ? await hasAdminSubscription(endpoint) : false
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? ''

  return NextResponse.json({
    subscribed,
    vapidPublicKey,
    available: !!vapidPublicKey,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { subscription?: unknown; userAgent?: string } = {}
  try { body = await req.json() } catch { /* invalid */ }

  const sub = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'subscription inválida' }, { status: 400 })
  }

  try {
    await upsertAdminSubscription(
      session.id,
      sub as never, // formato bate com PushSubscription do web-push
      body.userAgent ?? req.headers.get('user-agent'),
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/push POST]', err)
    return NextResponse.json({ error: 'Erro ao registrar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { endpoint?: string } = {}
  try { body = await req.json() } catch { /* invalid */ }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint obrigatório' }, { status: 400 })

  try {
    await removeAdminSubscription(body.endpoint)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/push DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 })
  }
}
