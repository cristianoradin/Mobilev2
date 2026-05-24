/**
 * GET  /api/propaganda  — lista todas as propagandas (portal admin)
 * POST /api/propaganda  — cria nova propaganda + dispara push opcional
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendPushNotification } from '@/lib/webpush'
import type { PushSubscription } from 'web-push'

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT id, titulo, descricao, imagem, cliente_ids, para_todos,
             duracao_horas, ativa, created_at, expires_at
      FROM propagandas
      ORDER BY created_at DESC
    `
    return NextResponse.json({ propagandas: rows })
  } catch (err) {
    console.error('[propaganda GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulo:        string
      descricao?:    string
      imagem?:       string | null   // base64 data URL
      cliente_ids?:  string[]
      para_todos?:   boolean
      duracao_horas: number
      enviar_push?:  boolean
    }

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
    }

    const sql         = getDb()
    const paraT       = body.para_todos ?? (body.cliente_ids?.length === 0)
    const clienteIds  = paraT ? [] : (body.cliente_ids ?? [])
    const expiresAt   = new Date(Date.now() + (body.duracao_horas ?? 24) * 3_600_000)

    const [row] = await sql`
      INSERT INTO propagandas (titulo, descricao, imagem, cliente_ids, para_todos, duracao_horas, expires_at)
      VALUES (
        ${body.titulo.trim()},
        ${body.descricao?.trim() ?? ''},
        ${body.imagem ?? null},
        ${clienteIds}::uuid[],
        ${paraT},
        ${body.duracao_horas ?? 24},
        ${expiresAt}
      )
      RETURNING id, titulo, expires_at
    `

    // Notificação push opcional
    let pushSent = 0
    if (body.enviar_push) {
      let subs: Array<Record<string, unknown>>
      if (paraT) {
        subs = await sql`SELECT endpoint, p256dh, auth_key FROM push_subscriptions`
      } else if (clienteIds.length > 0) {
        const cnpjs = await sql`SELECT cnpj FROM clientes WHERE id = ANY(${clienteIds}::uuid[])`
        const cnpjList = cnpjs.map(r => String(r.cnpj).replace(/\D/g, ''))
        subs = cnpjList.length > 0
          ? await sql`SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE cnpj = ANY(${cnpjList})`
          : []
      } else {
        subs = []
      }

      if (subs.length > 0) {
        const payload = {
          title: body.titulo.trim(),
          body:  body.descricao?.trim() || 'Nova propaganda disponível no app',
          icon:  '/logo.png',
          badge: '/icons/icon-192.png',
          tag:   `propaganda-${row.id}`,
          data:  { type: 'propaganda', route: '/', propaganda_id: row.id },
        }
        const results = await Promise.allSettled(
          (subs as Array<Record<string, unknown>>).map(s =>
            sendPushNotification(
              { endpoint: String(s.endpoint), keys: { p256dh: String(s.p256dh), auth: String(s.authKey) } } as PushSubscription,
              payload
            )
          )
        )
        pushSent = results.filter(r => r.status === 'fulfilled').length
      }
    }

    return NextResponse.json({ ok: true, id: row.id, push_sent: pushSent })
  } catch (err) {
    console.error('[propaganda POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
