/**
 * GET /api/mobile/propaganda
 * Retorna TODAS propagandas ativas pra cliente do JWT (carousel).
 * Mantém `propaganda` (singular) na resposta pra compat com PWA antigo.
 * Header: Authorization: Bearer <jwt>
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/jwt-verify'
import { getDb }              from '@/lib/db'

export async function GET(req: NextRequest) {
  const user      = await getUserFromRequest(req)
  const clienteId = user?.client_id ?? null
  if (!clienteId) return NextResponse.json({ propaganda: null, propagandas: [] }, { status: 401 })

  try {
    const sql = getDb()

    // Lista todas ativas + não expiradas pra carousel. Mais recente primeiro.
    const rows = await sql`
      SELECT id, titulo, descricao, imagem, duracao_horas, created_at, expires_at
      FROM propagandas
      WHERE ativa = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (para_todos = true OR ${clienteId}::uuid = ANY(cliente_ids))
      ORDER BY created_at DESC
      LIMIT 10
    `

    return NextResponse.json({
      propaganda:  rows[0] ?? null,   // compat com PWA antigo (1 só)
      propagandas: rows,              // novo: array pra carousel
    })
  } catch (err) {
    console.error('[mobile/propaganda]', err)
    return NextResponse.json({ propaganda: null, propagandas: [] })
  }
}
