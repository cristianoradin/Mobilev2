/**
 * GET /api/alertas
 *   Padrão: alertas abertos (para banner do dashboard).
 *   ?historico=true&days=30 → todos alertas dos últimos N dias (abertos + resolvidos).
 * Protegida por sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { getAlertasAbertos, getAlertasHistorico } from '@/lib/alertas'
import { verifySessionToken, SESSION_COOKIE }     from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const historico = req.nextUrl.searchParams.get('historico') === 'true'
  const days      = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 30), 1), 365)

  try {
    if (historico) {
      const alertas = await getAlertasHistorico(days)
      return NextResponse.json({ alertas, days, generatedAt: new Date().toISOString() })
    }
    const alertas = await getAlertasAbertos()
    return NextResponse.json({ alertas, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[alertas]', err)
    return NextResponse.json({ alertas: [], error: 'Erro interno' }, { status: 500 })
  }
}
