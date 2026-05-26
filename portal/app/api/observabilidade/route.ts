/**
 * GET /api/observabilidade
 * Retorna métricas completas do sistema para o dashboard de observabilidade.
 * Protegida por sessão de admin.
 */
import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { getDb }        from '@/lib/db'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { getEmqxStats, getEmqxMetrics } from '@/lib/emqxApi'

export const dynamic = 'force-dynamic'

// Envolve uma promise com fallback — uma query quebrada não derruba o dashboard inteiro.
// O fallback é tipado como `unknown` e cast para T no catch: o consumo a jusante usa apenas
// `rows[0]` e `?? 0` em todos os campos, então um array vazio ou `[{}]` funciona em runtime.
function safe<T>(p: PromiseLike<T>, fallback: unknown, name: string): Promise<T> {
  return Promise.resolve(p).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[observabilidade] query "${name}" falhou:`, msg)
    return fallback as T
  })
}

export async function GET() {
  // Auth
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const t0  = Date.now()
  const sql = getDb()

  // ── Tudo em paralelo ────────────────────────────────────────────────────────
  const [
    healthRow,
    summaryRow,
    agentesRows,
    auditRecentRows,
    auditByActionRows,
    auditHourlyRows,
    auditTotais24hRow,
    auditTotaisPrevRow,
    topClientesRows,
    licencasExpRows,
    versoesAgenteRows,
    hbBucketsRow,
    dbPoolRow,
  ] = await Promise.all([

    // 1. Health interno (latência DB)
    sql`SELECT 1 AS ok`.then(() => ({ dbOk: true, dbMs: Date.now() - t0 }))
                        .catch(() => ({ dbOk: false, dbMs: -1 })),

    // 2. Resumo geral
    safe(sql`
      SELECT
        (SELECT COUNT(*)              FROM clientes)                                             AS total_clientes,
        (SELECT COUNT(*) FILTER (WHERE ativo)  FROM clientes)                                   AS clientes_ativos,
        (SELECT COUNT(*)              FROM usuarios)                                             AS total_usuarios,
        (SELECT COUNT(*) FILTER (WHERE ativo)  FROM usuarios)                                   AS usuarios_ativos,
        (SELECT COUNT(*)              FROM agentes)                                              AS total_agentes,
        (SELECT COUNT(*) FILTER (WHERE ultimo_heartbeat > NOW() - INTERVAL '3 minutes')
                                      FROM agentes)                                             AS agentes_online,
        (SELECT COUNT(*)              FROM graficos)                                             AS total_graficos,
        (SELECT COUNT(*)              FROM push_subscriptions)                                  AS total_push_subs,
        (SELECT COUNT(*)              FROM admins WHERE ativo)                                  AS total_admins
    `, [{}] as never[], 'summary'),

    // 3. Agentes com cliente
    safe(sql`
      SELECT
        a.id, a.versao, a.status, a.ultimo_heartbeat,
        c.nome  AS cliente_nome,
        c.cnpj  AS cliente_cnpj,
        CASE WHEN a.ultimo_heartbeat > NOW() - INTERVAL '3 minutes'
             THEN 'online' ELSE 'offline' END AS status_real,
        EXTRACT(EPOCH FROM (NOW() - a.ultimo_heartbeat))::int AS segundos_atras
      FROM agentes a
      JOIN clientes c ON c.id = a.cliente_id
      ORDER BY a.ultimo_heartbeat DESC NULLS LAST
    `, [] as never[], 'agentes'),

    // 4. Audit log recente (últimos 30)
    safe(sql`
      SELECT
        al.id, al.acao, al.recurso, al.ip_address, al.status, al.created_at,
        al.payload->>'admin_email' AS admin_email,
        al.payload->>'admin_nome'  AS admin_nome
      FROM audit_log al
      ORDER BY al.created_at DESC
      LIMIT 30
    `, [] as never[], 'audit-recent'),

    // 5. Audit por ação — últimas 24h
    safe(sql`
      SELECT
        acao,
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE status = 'ok')       AS ok,
        COUNT(*) FILTER (WHERE status = 'warn')     AS warn,
        COUNT(*) FILTER (WHERE status = 'error')    AS error
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY acao
      ORDER BY COUNT(*) DESC
      LIMIT 12
    `, [] as never[], 'audit-by-action'),

    // 6. Audit por hora — últimas 24h (para sparkline)
    safe(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:MI') AS hora,
        COUNT(*)                                            AS total,
        COUNT(*) FILTER (WHERE status = 'ok')              AS ok,
        COUNT(*) FILTER (WHERE status != 'ok')             AS nok
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY DATE_TRUNC('hour', created_at)
    `, [] as never[], 'audit-hourly'),

    // 7. Totais 24h para o card de resumo
    safe(sql`
      SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE status = 'ok')           AS ok,
        COUNT(*) FILTER (WHERE status = 'warn')         AS warn,
        COUNT(*) FILTER (WHERE status = 'error')        AS error,
        COUNT(*) FILTER (WHERE acao = 'auth.login')     AS logins_ok,
        COUNT(*) FILTER (WHERE acao = 'auth.login_failed') AS logins_failed
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `, [{}] as never[], 'audit-totais-24h'),

    // 8. Totais 24-48h (janela anterior) — para calcular tendência
    safe(sql`
      SELECT
        COUNT(*)                                        AS total,
        COUNT(*) FILTER (WHERE status = 'error')        AS error,
        COUNT(*) FILTER (WHERE acao = 'auth.login_failed') AS logins_failed
      FROM audit_log
      WHERE created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
    `, [{}] as never[], 'audit-totais-prev'),

    // 9. Ranking clientes — eventos 24h + último acesso + #gráficos
    safe(sql`
      SELECT
        c.id,
        c.nome,
        c.cnpj,
        c.ativo,
        COUNT(al.id)                                  AS eventos24h,
        MAX(al.created_at)                            AS ultimo_evento,
        EXTRACT(EPOCH FROM (NOW() - MAX(al.created_at)))::int AS seg_desde_ultimo,
        (SELECT COUNT(*) FROM graficos g WHERE c.id = ANY(g.cliente_ids)) AS total_graficos
      FROM clientes c
      LEFT JOIN audit_log al
        ON al.cliente_id = c.id
       AND al.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY c.id, c.nome, c.cnpj, c.ativo
      ORDER BY eventos24h DESC, ultimo_evento DESC NULLS LAST
      LIMIT 15
    `, [] as never[], 'top-clientes'),

    // 10. Licenças expirando nos próximos 90 dias
    safe(sql`
      SELECT
        l.id,
        l.plano,
        l.data_expiracao,
        (l.data_expiracao - CURRENT_DATE)::int   AS dias_restantes,
        c.nome  AS cliente_nome,
        c.cnpj  AS cliente_cnpj
      FROM licencas l
      JOIN clientes c ON c.id = l.cliente_id
      WHERE l.ativa = true
        AND l.data_expiracao IS NOT NULL
        AND l.data_expiracao <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY l.data_expiracao ASC
      LIMIT 30
    `, [] as never[], 'licencas-exp'),

    // 11. Versões de agente em campo
    safe(sql`
      SELECT
        COALESCE(NULLIF(versao, ''), 'desconhecida') AS versao,
        COUNT(*)::int                                AS total,
        COUNT(*) FILTER (WHERE ultimo_heartbeat > NOW() - INTERVAL '3 minutes')::int AS online
      FROM agentes
      GROUP BY 1
      ORDER BY total DESC
    `, [] as never[], 'versoes-agente'),

    // 12. Heartbeat — distribuição de "quanto tempo desde o último HB"
    safe(sql`
      SELECT
        COUNT(*) FILTER (WHERE ultimo_heartbeat > NOW() - INTERVAL '5 minutes')                                                        AS b1_5min,
        COUNT(*) FILTER (WHERE ultimo_heartbeat BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes')                AS b2_15min,
        COUNT(*) FILTER (WHERE ultimo_heartbeat BETWEEN NOW() - INTERVAL '1 hour'     AND NOW() - INTERVAL '15 minutes')               AS b3_1h,
        COUNT(*) FILTER (WHERE ultimo_heartbeat BETWEEN NOW() - INTERVAL '24 hours'   AND NOW() - INTERVAL '1 hour')                   AS b4_24h,
        COUNT(*) FILTER (WHERE ultimo_heartbeat IS NULL OR ultimo_heartbeat < NOW() - INTERVAL '24 hours')                             AS b5_old
      FROM agentes
    `, [{}] as never[], 'hb-buckets'),

    // 13. DB pool — conexões ativas/idle/waiting do banco da app
    safe(sql`
      SELECT
        COUNT(*)::int                                                              AS total,
        COUNT(*) FILTER (WHERE state = 'active')::int                              AS ativas,
        COUNT(*) FILTER (WHERE state = 'idle')::int                                AS idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction')::int                 AS idle_txn,
        COUNT(*) FILTER (WHERE wait_event_type = 'Lock')::int                      AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `, [{}] as never[], 'db-pool'),
  ])

  // ── EMQX stats + metrics (via API key) ────────────────────────────────────
  const [emqxStats, emqxMetrics] = await Promise.all([
    getEmqxStats().catch(() => null),
    getEmqxMetrics().catch(() => null),
  ])

  // ── EMQX status (independente da auth do management API) ────────────────────
  let mqttOk = !!emqxStats  // se conseguiu stats, está OK
  if (!mqttOk) {
    try {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 2000)
      const res  = await fetch('http://emqx:18083/api/v5/status', { signal: ctrl.signal })
      clearTimeout(tid)
      mqttOk = res.ok
    } catch { /* unreachable */ }
  }

  const s    = summaryRow[0]
  const t24  = auditTotais24hRow[0]
  const tPrv = auditTotaisPrevRow[0]
  const hb   = hbBucketsRow[0]
  const pool = dbPoolRow[0]
  const h    = healthRow as { dbOk: boolean; dbMs: number }

  // ── Tendência: delta % entre 24h atual e 24h anterior ──────────────────────
  function deltaPct(now: number, prev: number): number | null {
    if (prev === 0) return now > 0 ? 100 : null
    return Math.round(((now - prev) / prev) * 100)
  }
  const trend = {
    total:        deltaPct(Number(t24?.total        ?? 0), Number(tPrv?.total        ?? 0)),
    error:        deltaPct(Number(t24?.error        ?? 0), Number(tPrv?.error        ?? 0)),
    loginsFailed: deltaPct(Number(t24?.loginsFailed ?? 0), Number(tPrv?.loginsFailed ?? 0)),
  }

  return NextResponse.json({
    health: {
      status:     h.dbOk ? 'ok' : 'degraded',
      db:         h.dbOk ? 'ok' : 'error',
      db_ms:      h.dbMs,
      mqtt:       mqttOk ? 'ok' : 'unreachable',
      uptime:     Math.floor(process.uptime()),
      latency_ms: Date.now() - t0,
    },
    summary: {
      totalClientes:   Number(s?.totalClientes   ?? 0),
      clientesAtivos:  Number(s?.clientesAtivos  ?? 0),
      totalUsuarios:   Number(s?.totalUsuarios   ?? 0),
      usuariosAtivos:  Number(s?.usuariosAtivos  ?? 0),
      totalAgentes:    Number(s?.totalAgentes    ?? 0),
      agentesOnline:   Number(s?.agentesOnline   ?? 0),
      totalGraficos:   Number(s?.totalGraficos   ?? 0),
      totalPushSubs:   Number(s?.totalPushSubs   ?? 0),
      totalAdmins:     Number(s?.totalAdmins     ?? 0),
    },
    agentes: agentesRows.map(a => ({
      id:            a.id,
      versao:        a.versao,
      statusReal:    a.statusReal,
      ultimoHb:      a.ultimoHeartbeat,
      segundosAtras: a.segundosAtras,
      clienteNome:   a.clienteNome,
      clienteCnpj:   a.clienteCnpj,
    })),
    audit: {
      recent:    auditRecentRows,
      byAction:  auditByActionRows,
      hourly:    auditHourlyRows,
      totais24h: {
        total:        Number(t24?.total        ?? 0),
        ok:           Number(t24?.ok           ?? 0),
        warn:         Number(t24?.warn         ?? 0),
        error:        Number(t24?.error        ?? 0),
        loginsOk:     Number(t24?.loginsOk     ?? 0),
        loginsFailed: Number(t24?.loginsFailed ?? 0),
      },
      trend,
    },
    topClientes: topClientesRows.map(r => ({
      id:             r.id,
      nome:           r.nome,
      cnpj:           r.cnpj,
      ativo:          r.ativo,
      eventos24h:     Number(r.eventos24h     ?? 0),
      ultimoEvento:   r.ultimoEvento,
      segDesdeUltimo: r.segDesdeUltimo,
      totalGraficos:  Number(r.totalGraficos  ?? 0),
    })),
    licencasExp: licencasExpRows.map(r => ({
      id:            r.id,
      plano:         r.plano,
      dataExpiracao: r.dataExpiracao,
      diasRestantes: Number(r.diasRestantes ?? 0),
      clienteNome:   r.clienteNome,
      clienteCnpj:   r.clienteCnpj,
    })),
    versoesAgente: versoesAgenteRows.map(r => ({
      versao: r.versao,
      total:  Number(r.total  ?? 0),
      online: Number(r.online ?? 0),
    })),
    hbBuckets: {
      b1_5min:  Number(hb?.b1_5min  ?? 0),
      b2_15min: Number(hb?.b2_15min ?? 0),
      b3_1h:    Number(hb?.b3_1h    ?? 0),
      b4_24h:   Number(hb?.b4_24h   ?? 0),
      b5_old:   Number(hb?.b5_old   ?? 0),
    },
    infra: {
      emqx: emqxStats ? {
        available:       true,
        connections:     emqxStats.connections,
        liveConnections: emqxStats.liveConnections,
        sessions:        emqxStats.sessions,
        subscriptions:   emqxStats.subscriptions,
        topics:          emqxStats.topics,
        msgsInRate:      Math.round((emqxMetrics?.msgsReceivedRate ?? 0) * 10) / 10,
        msgsOutRate:     Math.round((emqxMetrics?.msgsSentRate     ?? 0) * 10) / 10,
        msgsInTotal:     emqxMetrics?.msgsTotalReceived ?? 0,
        msgsOutTotal:    emqxMetrics?.msgsTotalSent     ?? 0,
      } : {
        available: false,
      },
      dbPool: {
        total:    Number(pool?.total    ?? 0),
        ativas:   Number(pool?.ativas   ?? 0),
        idle:     Number(pool?.idle     ?? 0),
        idleTxn:  Number(pool?.idleTxn  ?? 0),
        waiting:  Number(pool?.waiting  ?? 0),
        max:      Number(process.env.DB_POOL_MAX ?? 20),
      },
    },
    generatedAt: new Date().toISOString(),
  })
}
