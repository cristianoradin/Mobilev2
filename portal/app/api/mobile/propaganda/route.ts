/**
 * GET /api/mobile/propaganda
 * Retorna a propaganda ativa mais recente para o cliente do JWT.
 * Header: Authorization: Bearer <jwt>
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getDb } from '@/lib/db'

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
  if (!clienteId) return NextResponse.json({ propaganda: null }, { status: 401 })

  try {
    const sql = getDb()

    // Busca propaganda ativa, não expirada, para este cliente ou para todos
    const rows = await sql`
      SELECT id, titulo, descricao, imagem, duracao_horas, created_at, expires_at
      FROM propagandas
      WHERE ativa = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (para_todos = true OR ${clienteId}::uuid = ANY(cliente_ids))
      ORDER BY created_at DESC
      LIMIT 1
    `

    return NextResponse.json({ propaganda: rows[0] ?? null })
  } catch (err) {
    console.error('[mobile/propaganda]', err)
    return NextResponse.json({ propaganda: null })
  }
}
