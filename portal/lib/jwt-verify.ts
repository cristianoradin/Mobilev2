/**
 * jwt-verify.ts — verificação centralizada de JWTs de usuários PWA.
 *
 * Estratégia dual:
 *  1. RS256 com JWT_PUBLIC_KEY (produção)
 *  2. HS256 com JWT_SECRET    (dev / tokens antigos — fallback)
 *
 * A função com revogação faz um SELECT rápido para checar token_version.
 * Se o DB estiver fora, aceita o token (modo degraded).
 */
import { jwtVerify, importSPKI } from 'jose'
import { getDb } from './db'

const HS256_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

export interface UserJWTPayload {
  sub:       string     // usuario_id
  client_id: string
  cnpj:      string
  role:      string
  empresas:  number[]
  tv?:       number     // token_version (tokens novos)
  type:      'user_token'
}

// Importa chave pública apenas uma vez por processo
let _pubKey: Awaited<ReturnType<typeof importSPKI>> | null | undefined = undefined
async function getPublicKey() {
  if (_pubKey !== undefined) return _pubKey
  const pem = process.env.JWT_PUBLIC_KEY
  if (!pem) { _pubKey = null; return null }
  _pubKey = await importSPKI(pem.replace(/\\n/g, '\n'), 'RS256')
  return _pubKey
}

/** Verifica assinatura JWT (RS256 → HS256 fallback). Não checa revogação. */
export async function verifyUserJWT(token: string): Promise<UserJWTPayload | null> {
  const pubKey = await getPublicKey()

  if (pubKey) {
    try {
      const { payload } = await jwtVerify(token, pubKey, { issuer: 'sgapetro.cloud' })
      return payload as unknown as UserJWTPayload
    } catch { /* tenta HS256 */ }
  }

  try {
    const { payload } = await jwtVerify(token, HS256_SECRET, { issuer: 'sgapetro.cloud' })
    return payload as unknown as UserJWTPayload
  } catch {
    return null
  }
}

/**
 * Verifica assinatura E token_version contra o DB.
 * Use em rotas que precisam de garantia forte de revogação.
 * Tokens sem `tv` (antigos) são aceitos — migração gradual.
 */
export async function verifyUserJWTStrict(token: string): Promise<UserJWTPayload | null> {
  const payload = await verifyUserJWT(token)
  if (!payload) return null

  // Tokens sem tv: compatibilidade retroativa (antes da Etapa 3)
  if (payload.tv === undefined) return payload

  try {
    const sql  = getDb()
    const rows = await sql`
      SELECT COALESCE(token_version, 1) AS token_version
      FROM   usuarios
      WHERE  id = ${payload.sub} AND ativo = true
    `
    if (!rows[0]) return null
    if ((rows[0].tokenVersion as number) !== payload.tv) return null
  } catch {
    // DB fora: modo degraded — aceita o token
  }

  return payload
}

/** Extrai e verifica o JWT do header Authorization: Bearer <token> */
export async function getUserFromRequest(
  req: { headers: { get(name: string): string | null } },
  strict = false,
): Promise<UserJWTPayload | null> {
  const auth  = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return strict ? verifyUserJWTStrict(token) : verifyUserJWT(token)
}
