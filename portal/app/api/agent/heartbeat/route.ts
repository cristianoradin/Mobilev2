/**
 * POST /api/agent/heartbeat
 * Chamado pelo agente local a cada 60 s para registrar presença no DB.
 *
 * Auth: Authorization: Bearer <agent_jwt>
 * Body: { agent_id: string; versao: string; status?: "online" | "offline" | "degraded" }
 *
 * Faz UPSERT na tabela agentes (sem unique constraint → usa CTE update-first).
 */
import { NextRequest, NextResponse }    from 'next/server'
import { jwtVerify, importSPKI }        from 'jose'
import { getDb }                        from '@/lib/db'
import { syncAllTemplatesToAgent }      from '@/lib/syncTemplate'

// ── JWT verification ────────────────────────────────────────────────────────────
const HS_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

interface AgentClaims {
  sub:     string   // cliente_id
  cnpj:    string
  plano:   string
  type:    string
  empresas?: number[]
}

async function verifyAgentJWT(token: string): Promise<AgentClaims | null> {
  try {
    // Tenta RS256 primeiro (produção), cai em HS256 (desenvolvimento)
    const pubPem = process.env.JWT_PUBLIC_KEY
    if (pubPem) {
      const normalized = pubPem.replace(/\\n/g, '\n')
      const pub = await importSPKI(normalized, 'RS256')
      const { payload } = await jwtVerify(token, pub, {
        issuer:   'sgapetro.cloud',
        algorithms: ['RS256'],
      })
      if (payload['type'] !== 'agent_token') return null
      return payload as unknown as AgentClaims
    }
  } catch { /* cai para HS256 */ }

  try {
    const { payload } = await jwtVerify(token, HS_SECRET, {
      issuer:   'sgapetro.cloud',
      algorithms: ['HS256'],
    })
    if (payload['type'] !== 'agent_token') return null
    return payload as unknown as AgentClaims
  } catch {
    return null
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Extrai Bearer token
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Authorization header ausente' }, { status: 401 })
  }

  const claims = await verifyAgentJWT(token)
  if (!claims || !claims.sub) {
    return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 })
  }

  const clienteId = claims.sub

  // Body
  let body: { agent_id?: string; versao?: string; status?: string } = {}
  try { body = await req.json() } catch { /* body opcional */ }

  const versao  = body.versao  ?? '1.0.0'
  const status  = (['online','offline','degraded'].includes(body.status ?? ''))
    ? body.status!
    : 'online'

  try {
    const sql = getDb()

    // UPSERT sem unique constraint — update-first CTE
    // Retorna o último heartbeat anterior para detectar reconexão
    const result = await sql`
      WITH upd AS (
        UPDATE agentes
        SET    status           = ${status},
               ultimo_heartbeat = NOW(),
               versao           = ${versao}
        WHERE  cliente_id = ${clienteId}::uuid
        RETURNING id, ultimo_heartbeat AS prev_heartbeat
      )
      INSERT INTO agentes (cliente_id, status, ultimo_heartbeat, versao)
      SELECT ${clienteId}::uuid, ${status}, NOW(), ${versao}
      WHERE  NOT EXISTS (SELECT 1 FROM upd)
      RETURNING id, NULL::timestamptz AS prev_heartbeat
    `

    // Re-sincroniza todos os templates se agente estava offline > 2 minutos
    // (heartbeat normal é 60s; gap > 2min indica que estava desconectado)
    const prevHb = result[0]?.prevHeartbeat as Date | null
    const agentReconnected = !prevHb ||
      (Date.now() - new Date(prevHb).getTime()) > 2 * 60 * 1000

    if (agentReconnected && status === 'online') {
      const cnpj = claims.cnpj
      // Fire-and-forget — não bloqueia a resposta HTTP
      void syncAllTemplatesToAgent(clienteId, cnpj)
      console.log(`[heartbeat] Agente ${cnpj} reconectou — re-sync de templates iniciado`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[agent/heartbeat]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
