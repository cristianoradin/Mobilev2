/**
 * GET /api/mobile/dashboards
 * Retorna os dashboards disponíveis para o cliente do JWT.
 * Apenas dashboards criados pelo admin com is_publico=true ou cliente_id liberado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getDashboardsForCliente } from '@/lib/repositories/liberacoes'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

async function getClienteId(req: NextRequest): Promise<string | null> {
  const auth  = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return (payload as Record<string, unknown>).client_id as string ?? null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const clienteId = await getClienteId(req)
  if (!clienteId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const dashboards = await getDashboardsForCliente(clienteId)
    return NextResponse.json({ dashboards })
  } catch (err) {
    console.error('[mobile/dashboards]', err)
    return NextResponse.json({ dashboards: [] })
  }
}
