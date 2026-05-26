/**
 * GET /api/agent/status
 * Retorna todos os clientes com informações do agente instalado.
 * Cruza agentes + clientes para montar o painel de versões.
 */
import { NextResponse } from 'next/server'
import { getDb }        from '@/lib/db'

export async function GET() {
  try {
    const sql = await getDb()

    // status derivado de heartbeat — coluna a.status no DB não invalida quando o
    // agente para de bater. Single source of truth = ultimo_heartbeat < 3min.
    const rows = await sql`
      SELECT
        c.id          AS cliente_id,
        c.nome        AS cliente_nome,
        c.cnpj,
        c.ativo,
        a.versao,
        CASE
          WHEN a.ultimo_heartbeat IS NULL                              THEN NULL
          WHEN a.ultimo_heartbeat > NOW() - INTERVAL '3 minutes'       THEN 'online'
          ELSE 'offline'
        END           AS status,
        a.ultimo_heartbeat
      FROM clientes c
      LEFT JOIN agentes a ON a.cliente_id = c.id
      WHERE c.ativo = true
      ORDER BY c.nome
    `

    return NextResponse.json({ clientes: rows })
  } catch (err) {
    console.error('[GET /api/agent/status]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
