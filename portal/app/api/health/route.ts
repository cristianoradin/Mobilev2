/**
 * GET /api/health
 * Endpoint de observabilidade — verifica DB, EMQX e estado dos agentes.
 * Usado pelo nginx, scripts de deploy e monitoramento.
 */
import { NextResponse } from 'next/server'
import { getDb }        from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()

  // ── DB ──────────────────────────────────────────────────────────────────────
  let dbOk    = false
  let dbMs    = 0
  let agents  = { online: 0, total: 0 }

  try {
    const sql = getDb()
    const t1  = Date.now()
    const [pingRow, agentRow] = await Promise.all([
      sql`SELECT 1 AS ok`,
      sql`
        SELECT
          COUNT(*)                                                   AS total,
          COUNT(*) FILTER (
            WHERE ultimo_heartbeat > NOW() - INTERVAL '10 minutes'
          )                                                          AS online
        FROM agentes
      `,
    ])
    dbMs   = Date.now() - t1
    dbOk   = !!pingRow[0]
    agents = {
      online: Number(agentRow[0]?.online ?? 0),
      total:  Number(agentRow[0]?.total  ?? 0),
    }
  } catch { /* dbOk permanece false */ }

  // ── EMQX ────────────────────────────────────────────────────────────────────
  let mqttOk = false
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 2000)
    const res  = await fetch('http://emqx:18083/api/v5/status', { signal: ctrl.signal })
    clearTimeout(tid)
    mqttOk = res.ok
  } catch { /* mqttOk permanece false — aceitável */ }

  const status = dbOk ? 'ok' : 'degraded'
  const code   = dbOk ? 200 : 503

  return NextResponse.json(
    {
      status,
      db:     dbOk ? 'ok' : 'error',
      db_ms:  dbMs,
      mqtt:   mqttOk ? 'ok' : 'unreachable',
      agents,
      uptime: Math.floor(process.uptime()),
      ts:     new Date().toISOString(),
      latency_ms: Date.now() - t0,
    },
    { status: code },
  )
}
