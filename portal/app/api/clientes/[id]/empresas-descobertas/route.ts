/**
 * GET /api/clientes/[id]/empresas-descobertas
 * Lista empresas descobertas pelo agente, com status de vinculação.
 * Auth: sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const sql = getDb()
    const rows = await sql`
      SELECT
        d.id,
        d.empcodigo,
        d.empnome,
        d.empcnpj_clean,
        d.vinculada_empresa_id,
        d.first_seen,
        d.last_seen,
        e.nome AS vinculada_nome
      FROM empresas_descobertas d
      LEFT JOIN empresas e ON e.id = d.vinculada_empresa_id
      WHERE d.cliente_id = ${id}::uuid
      ORDER BY d.empcodigo
    `
    return NextResponse.json({ empresas: rows })
  } catch (err) {
    console.error('[empresas-descobertas GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
