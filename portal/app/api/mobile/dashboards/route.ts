/**
 * GET /api/mobile/dashboards
 * Retorna os dashboards disponíveis para o cliente do JWT.
 * Apenas dashboards criados pelo admin com is_publico=true ou cliente_id liberado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest }      from '@/lib/jwt-verify'
import { getDashboardsForCliente } from '@/lib/repositories/liberacoes'

export async function GET(req: NextRequest) {
  const user      = await getUserFromRequest(req)
  const clienteId = user?.client_id ?? null
  if (!clienteId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const dashboards = await getDashboardsForCliente(clienteId)
    return NextResponse.json({ dashboards })
  } catch (err) {
    console.error('[mobile/dashboards]', err)
    return NextResponse.json({ dashboards: [] })
  }
}
