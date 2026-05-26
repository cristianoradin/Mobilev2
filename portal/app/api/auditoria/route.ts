/**
 * GET /api/auditoria
 * Lista eventos de auditoria com filtros e paginação.
 *
 * Query params:
 *   q        — busca textual (acao, recurso, ip, admin_email via payload)
 *   status   — ok | warn | error
 *   page     — página (0-based, default 0)
 *   limit    — itens por página (default 50, max 200)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbAvailable } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (!isDbAvailable()) {
    return NextResponse.json({ events: [], total: 0 })
  }

  const sp     = req.nextUrl.searchParams
  const q      = sp.get('q')?.trim() ?? ''
  const status = sp.get('status') ?? ''
  const page   = Math.max(0, parseInt(sp.get('page') ?? '0', 10))
  const limit  = Math.min(200, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)))
  const offset = page * limit

  try {
    const db = getDb()

    // Monta a query dinamicamente
    const rows = await db`
      SELECT
        a.id,
        a.acao,
        a.recurso,
        a.ip_address::text                             AS ip_address,
        a.status,
        a.created_at,
        c.nome                                         AS cliente_nome,
        a.cliente_id::text                             AS cliente_id,
        a.payload->>'admin_email'                      AS admin_email,
        a.payload->>'admin_nome'                       AS admin_nome
      FROM audit_log a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      WHERE
        (${status} = '' OR a.status = ${status})
        AND (
          ${q} = ''
          OR a.acao       ILIKE ${'%' + q + '%'}
          OR a.recurso    ILIKE ${'%' + q + '%'}
          OR a.ip_address::text ILIKE ${'%' + q + '%'}
          OR c.nome       ILIKE ${'%' + q + '%'}
          OR a.payload->>'admin_email' ILIKE ${'%' + q + '%'}
          OR a.payload->>'admin_nome'  ILIKE ${'%' + q + '%'}
        )
      ORDER BY a.created_at DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `

    const countRow = await db`
      SELECT COUNT(*)::int AS total
      FROM audit_log a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      WHERE
        (${status} = '' OR a.status = ${status})
        AND (
          ${q} = ''
          OR a.acao       ILIKE ${'%' + q + '%'}
          OR a.recurso    ILIKE ${'%' + q + '%'}
          OR a.ip_address::text ILIKE ${'%' + q + '%'}
          OR c.nome       ILIKE ${'%' + q + '%'}
          OR a.payload->>'admin_email' ILIKE ${'%' + q + '%'}
          OR a.payload->>'admin_nome'  ILIKE ${'%' + q + '%'}
        )
    `
    const total = countRow[0]?.total ?? 0

    const events = rows.map(r => ({
      id:           Number(r.id),
      acao:         String(r.acao),
      recurso:      r.recurso      ? String(r.recurso)      : null,
      ip_address:   r.ipAddress    ? String(r.ipAddress)    : null,
      status:       String(r.status) as 'ok' | 'warn' | 'error',
      created_at:   String(r.createdAt),
      cliente_nome: r.clienteNome  ? String(r.clienteNome)  : null,
      cliente_id:   r.clienteId    ? String(r.clienteId)    : null,
      admin_email:  r.adminEmail   ? String(r.adminEmail)   : null,
      admin_nome:   r.adminNome    ? String(r.adminNome)    : null,
    }))

    return NextResponse.json({ events, total, page, limit })
  } catch (err) {
    console.error('[auditoria] Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
