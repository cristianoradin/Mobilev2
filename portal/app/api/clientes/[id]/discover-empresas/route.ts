/**
 * POST /api/clientes/[id]/discover-empresas
 * Pede ao agente do cliente que rode discovery agora (via MQTT).
 * Agente vai chamar POST /api/agent/empresas-discovered em seguida.
 *
 * Auth: sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { getDb }      from '@/lib/db'
import { publishMqtt } from '@/lib/mqttpublish'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const sql = getDb()
    const [cliente] = await sql`SELECT cnpj FROM clientes WHERE id = ${id}::uuid LIMIT 1`
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    const cnpjClean = String(cliente.cnpj).replace(/[.\-/]/g, '')
    const topic     = `sga/${cnpjClean}/command`

    await publishMqtt(topic, {
      type:       'DISCOVER_EMPRESAS',
      request_id: randomUUID(),
      timestamp:  Date.now(),
    })

    return NextResponse.json({ ok: true, message: 'Comando enviado ao agente — aguarde alguns segundos' })
  } catch (err) {
    console.error('[discover-empresas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
