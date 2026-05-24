/**
 * POST /api/push/send
 * Dispara Web Push para todos os dispositivos registrados de um cnpj.
 * Chamado pelo agente Go (ou qualquer serviço interno) quando há um alerta.
 *
 * Autenticação: Bearer token via env PUSH_SECRET (opcional em dev)
 *
 * Body: {
 *   cnpj:    string
 *   title:   string
 *   body:    string
 *   tag?:    string
 *   data?:   Record<string, unknown>
 *   priority?: 'normal' | 'high'
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptions, removeSubscription } from '@/lib/pushStore'
import { sendPushNotification } from '@/lib/webpush'

const PUSH_SECRET = process.env.PUSH_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Validação opcional de secret (pula em dev se não configurado)
  if (PUSH_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${PUSH_SECRET}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  try {
    const body = await req.json() as {
      cnpj?:     string
      title?:    string
      body?:     string
      tag?:      string
      data?:     Record<string, unknown>
      priority?: 'normal' | 'high'
    }

    if (!body.cnpj || !body.title || !body.body) {
      return NextResponse.json(
        { error: 'cnpj, title e body são obrigatórios' },
        { status: 400 }
      )
    }

    const cnpj = body.cnpj.replace(/\D/g, '')
    const subs = await getSubscriptions(cnpj)

    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'Nenhum dispositivo registrado' })
    }

    const payload = {
      title: body.title,
      body:  body.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   body.tag ?? 'sga-alert',
      data:  { priority: body.priority ?? 'normal', ...body.data },
    }

    let sent = 0
    const results = await Promise.allSettled(
      subs.map(sub => sendPushNotification(sub, payload).then(ok => ({ ok, sub })))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ok) {
          sent++
        } else {
          await removeSubscription(cnpj, result.value.sub.endpoint)
        }
      }
    }

    return NextResponse.json({ ok: true, sent, total: subs.length })
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
