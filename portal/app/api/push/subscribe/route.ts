/**
 * POST /api/push/subscribe
 * Recebe a PushSubscription do PWA e armazena para envios futuros.
 *
 * Body: { subscription: PushSubscription, cnpj: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { addSubscription } from '@/lib/pushStore'
import type { PushSubscription } from 'web-push'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { subscription?: PushSubscription; cnpj?: string }

    if (!body.subscription || !body.cnpj) {
      return NextResponse.json(
        { error: 'subscription e cnpj são obrigatórios' },
        { status: 400 }
      )
    }

    // Sanitiza CNPJ: apenas dígitos
    const cnpj = body.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }

    addSubscription(cnpj, body.subscription)

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
