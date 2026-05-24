/**
 * GET /api/push/history
 * Retorna histórico de comunicados enviados (para o portal e para o PWA).
 *
 * Query params:
 *   cnpj?    — filtra por cnpj do posto (PWA usa isso para mostrar só seus)
 *   limit?   — máx registros (default 50)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const sql    = getDb()
    const params = req.nextUrl.searchParams
    const cnpj   = params.get('cnpj')
    const limit  = Math.min(Number(params.get('limit') ?? 50), 200)

    let rows: Array<Record<string, unknown>>

    if (cnpj) {
      // PWA: busca comunicados que foram para todos (cliente_id IS NULL)
      // ou para este cliente específico (by cnpj → cliente_id)
      const cleaned = cnpj.replace(/\D/g, '')
      rows = await sql`
        SELECT
          h.id, h.title, h.body, h.route, h.sent_count, h.created_at,
          h.cliente_nome,
          CASE WHEN h.cliente_id IS NULL THEN true ELSE false END AS para_todos
        FROM notification_history h
        LEFT JOIN clientes c ON c.id = h.cliente_id
        WHERE h.cliente_id IS NULL
           OR (c.cnpj IS NOT NULL AND replace(c.cnpj, '.', '') LIKE ${'%' + cleaned.slice(-8)})
        ORDER BY h.created_at DESC
        LIMIT ${limit}
      `
    } else {
      // Portal: todos os comunicados
      rows = await sql`
        SELECT id, title, body, route, sent_count, created_at, cliente_nome,
               CASE WHEN cliente_id IS NULL THEN true ELSE false END AS para_todos
        FROM notification_history
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    return NextResponse.json({
      history: rows.map(r => ({
        id:          String(r.id),
        title:       String(r.title),
        body:        String(r.body),
        route:       r.route ? String(r.route) : null,
        sent_count:  Number(r.sentCount),
        created_at:  String(r.createdAt),
        cliente_nome: r.clienteNome ? String(r.clienteNome) : null,
        para_todos:  Boolean(r.paraTodos),
      }))
    })
  } catch (err) {
    console.error('[push/history]', err)
    return NextResponse.json({ history: [] })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    const sql = getDb()
    await sql`DELETE FROM notification_history WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/history DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
