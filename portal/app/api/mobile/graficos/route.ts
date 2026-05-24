/**
 * GET /api/mobile/graficos
 * Retorna templates de gráfico disponíveis para o cliente do JWT.
 * Combina:
 *   - SYSTEM_TEMPLATES liberados via template_liberacoes
 *   - Graficos customizados do DB com is_publico=true ou cliente_id liberado
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getTemplateKeysForCliente } from '@/lib/repositories/liberacoes'
import { getGraficosForCliente }     from '@/lib/repositories/graficos'
import { SYSTEM_TEMPLATES }          from '@/lib/templates'

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
    const [keys, customGraficos] = await Promise.all([
      getTemplateKeysForCliente(clienteId),
      getGraficosForCliente(clienteId),
    ])

    // Templates do sistema filtrados pela liberação
    const systemGraficos = SYSTEM_TEMPLATES.filter(t => keys.includes(t.id))

    return NextResponse.json({ graficos: [...systemGraficos, ...customGraficos] })
  } catch (err) {
    console.error('[mobile/graficos]', err)
    return NextResponse.json({ graficos: [] })
  }
}
