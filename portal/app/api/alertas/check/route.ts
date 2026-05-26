/**
 * POST /api/alertas/check
 * Roda as regras de detecção e reconcilia o estado dos alertas.
 * Protegida por token compartilhado (ALERTS_CHECK_TOKEN) — chamada pelo cron do servidor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkAlertas } from '@/lib/alertas'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const expected = process.env.ALERTS_CHECK_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'ALERTS_CHECK_TOKEN não configurado' }, { status: 500 })
  }
  const given = req.headers.get('x-alerts-token')
  if (given !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await checkAlertas()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[alertas/check]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
