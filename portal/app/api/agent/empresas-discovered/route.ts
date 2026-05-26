/**
 * POST /api/agent/empresas-discovered
 * Agente reporta empresas encontradas no banco local do cliente.
 *
 * Auth: Authorization: Bearer <agent_jwt>
 * Body: {
 *   agent_id?: string
 *   empresas: Array<{ empcodigo: number; empnome: string; empcnpj?: string }>
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, importSPKI } from 'jose'
import { getDb } from '@/lib/db'

const HS_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

interface AgentClaims {
  sub:  string   // cliente_id
  cnpj: string
  type: string
}

async function verifyAgent(token: string): Promise<AgentClaims | null> {
  try {
    const pubPem = process.env.JWT_PUBLIC_KEY
    if (pubPem) {
      const pub = await importSPKI(pubPem.replace(/\\n/g, '\n'), 'RS256')
      const { payload } = await jwtVerify(token, pub, { issuer: 'sgapetro.cloud', algorithms: ['RS256'] })
      if (payload['type'] !== 'agent_token') return null
      return payload as unknown as AgentClaims
    }
  } catch { /* fallback */ }
  try {
    const { payload } = await jwtVerify(token, HS_SECRET, { issuer: 'sgapetro.cloud', algorithms: ['HS256'] })
    if (payload['type'] !== 'agent_token') return null
    return payload as unknown as AgentClaims
  } catch { return null }
}

interface DiscoveredEmpresa {
  empcodigo: number
  empnome:   string
  empcnpj?:  string
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Authorization ausente' }, { status: 401 })

  const claims = await verifyAgent(token)
  if (!claims?.sub) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  let body: { agent_id?: string; empresas?: DiscoveredEmpresa[] } = {}
  try { body = await req.json() } catch { /* invalid */ }

  const lista = body.empresas ?? []
  if (!Array.isArray(lista)) return NextResponse.json({ error: 'empresas deve ser array' }, { status: 400 })

  const agentId   = body.agent_id ?? null
  const clienteId = claims.sub

  try {
    const sql = getDb()
    let inseridos = 0
    let atualizados = 0

    for (const e of lista) {
      const codigo = Number(e.empcodigo)
      if (!Number.isFinite(codigo) || codigo <= 0) continue
      const nome   = String(e.empnome ?? '').trim().slice(0, 200) || `Empresa ${codigo}`
      const cnpj   = String(e.empcnpj ?? '').replace(/\D/g, '').slice(0, 14) || null

      const result = await sql`
        INSERT INTO empresas_descobertas (cliente_id, agent_id, empcodigo, empnome, empcnpj_clean, first_seen, last_seen)
        VALUES (
          ${clienteId}::uuid,
          ${agentId ? `${agentId}::uuid` : null}::uuid,
          ${codigo},
          ${nome},
          ${cnpj},
          NOW(),
          NOW()
        )
        ON CONFLICT (cliente_id, empcodigo) DO UPDATE
          SET empnome       = EXCLUDED.empnome,
              empcnpj_clean = EXCLUDED.empcnpj_clean,
              agent_id      = COALESCE(EXCLUDED.agent_id, empresas_descobertas.agent_id),
              last_seen     = NOW()
        RETURNING (xmax = 0) AS was_inserted
      `
      if (result[0]?.wasInserted) inseridos++
      else atualizados++
    }

    return NextResponse.json({ ok: true, inseridos, atualizados, total: lista.length })
  } catch (err) {
    console.error('[empresas-discovered]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
