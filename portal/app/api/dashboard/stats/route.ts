/**
 * GET /api/dashboard/stats
 * Retorna KPIs, status dos agentes e atividade recente com dados reais do banco.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const sql = getDb()

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const [kpiRows] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM clientes WHERE ativo = true)                             AS clientes_ativos,
        (SELECT COUNT(*)::int FROM graficos)                                                AS graficos_total,
        (SELECT COUNT(*)::int FROM agentes WHERE status = 'online')                        AS agentes_online,
        (SELECT COUNT(*)::int FROM agentes)                                                 AS agentes_total,
        (SELECT COUNT(*)::int FROM licencas WHERE ativa = true
          AND (expires_at IS NULL OR expires_at > NOW()))                                   AS licencas_ativas
    `

    // ── Status dos agentes (com nome do cliente) ──────────────────────────────
    const agentes = await sql`
      SELECT
        a.id,
        a.status,
        a.ultimo_heartbeat,
        a.versao,
        c.nome  AS cliente_nome,
        c.cnpj
      FROM agentes a
      JOIN clientes c ON c.id = a.cliente_id
      ORDER BY
        CASE a.status WHEN 'online' THEN 0 ELSE 1 END,
        a.ultimo_heartbeat DESC NULLS LAST
      LIMIT 20
    `

    // ── Atividade recente — une eventos de várias tabelas ────────────────────
    const atividade = await sql`
      SELECT acao, detalhe, created_at FROM (

        SELECT
          'Cliente cadastrado'  AS acao,
          nome                  AS detalhe,
          created_at
        FROM clientes
        ORDER BY created_at DESC LIMIT 5

      ) q1

      UNION ALL

      SELECT acao, detalhe, created_at FROM (

        SELECT
          'Propaganda criada'   AS acao,
          titulo                AS detalhe,
          created_at
        FROM propagandas
        ORDER BY created_at DESC LIMIT 5

      ) q2

      UNION ALL

      SELECT acao, detalhe, created_at FROM (

        SELECT
          CASE status
            WHEN 'online'  THEN 'Agente conectado'
            ELSE                'Agente desconectado'
          END                   AS acao,
          c.nome                AS detalhe,
          a.ultimo_heartbeat    AS created_at
        FROM agentes a
        JOIN clientes c ON c.id = a.cliente_id
        WHERE a.ultimo_heartbeat IS NOT NULL
        ORDER BY a.ultimo_heartbeat DESC LIMIT 5

      ) q3

      UNION ALL

      SELECT acao, detalhe, created_at FROM (

        SELECT
          'Gráfico criado'      AS acao,
          nome                  AS detalhe,
          created_at
        FROM graficos
        ORDER BY created_at DESC LIMIT 5

      ) q4

      UNION ALL

      SELECT acao, detalhe, created_at FROM (

        SELECT
          'Licença gerada'      AS acao,
          c.nome                AS detalhe,
          l.created_at
        FROM licencas l
        JOIN clientes c ON c.id = l.cliente_id
        ORDER BY l.created_at DESC LIMIT 5

      ) q5

      ORDER BY created_at DESC
      LIMIT 15
    `

    return NextResponse.json({
      kpis: {
        clientesAtivos: kpiRows.clientesAtivos ?? 0,
        graficosTotal:  kpiRows.graficosTotal  ?? 0,
        agentesOnline:  kpiRows.agentesOnline  ?? 0,
        agentesTotal:   kpiRows.agentesTotal   ?? 0,
        licencasAtivas: kpiRows.licencasAtivas ?? 0,
      },
      agentes,
      atividade,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
