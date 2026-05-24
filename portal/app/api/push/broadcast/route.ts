/**
 * POST /api/push/broadcast
 * Dispara comunicado do portal para um cliente específico ou todos.
 *
 * Body: {
 *   cliente_id?:   string    (null = todos)
 *   cliente_nome?: string
 *   title:         string
 *   body:          string
 *   route?:        string    (rota PWA para abrir ao clicar, ex: '/config/notificacoes')
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendPushNotification } from '@/lib/webpush'
import type { PushSubscription } from 'web-push'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      cliente_id?:   string | null
      cliente_nome?: string
      title?:        string
      body?:         string
      route?:        string
    }

    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 })
    }

    const sql = getDb()

    // Busca subscriptions: específicas de um cliente (pelo cnpj) ou todas
    let rows: Array<Record<string, unknown>>
    if (body.cliente_id) {
      // Busca cnpj do cliente para filtrar subscriptions
      const clientes = await sql`SELECT cnpj FROM clientes WHERE id = ${body.cliente_id} LIMIT 1`
      if (!clientes[0]) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
      const cnpj = String(clientes[0].cnpj).replace(/\D/g, '')
      rows = await sql`SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE cnpj = ${cnpj}`
    } else {
      rows = await sql`SELECT endpoint, p256dh, auth_key FROM push_subscriptions`
    }

    const subs: PushSubscription[] = rows.map(r => ({
      endpoint: String(r.endpoint),
      keys: { p256dh: String(r.p256dh), auth: String(r.authKey) },
    })) as PushSubscription[]

    const payload = {
      title: body.title.trim(),
      body:  body.body.trim(),
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   'comunicado',
      data:  {
        type:  'comunicado',
        route: body.route ?? '/config/notificacoes',
      },
    }

    let sent = 0
    if (subs.length > 0) {
      const results = await Promise.allSettled(
        subs.map(sub => sendPushNotification(sub, payload).then(ok => ({ ok, endpoint: sub.endpoint })))
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) sent++
      }
    }

    // Salva no histórico
    await sql`
      INSERT INTO notification_history (cliente_id, cliente_nome, title, body, route, sent_count)
      VALUES (
        ${body.cliente_id ?? null},
        ${body.cliente_nome ?? null},
        ${body.title.trim()},
        ${body.body.trim()},
        ${body.route ?? '/config/notificacoes'},
        ${sent}
      )
    `

    return NextResponse.json({ ok: true, sent, total: subs.length })
  } catch (err) {
    console.error('[push/broadcast]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
