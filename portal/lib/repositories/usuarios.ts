import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { getDb } from '@/lib/db'
import type { UserRole } from '@/lib/types'

// ── Hashing seguro com scrypt (built-in Node.js, sem dependências externas) ──
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const hashBuffer = Buffer.from(hash, 'hex')
    const derived    = scryptSync(password, salt, 64)
    return timingSafeEqual(derived, hashBuffer)
  } catch {
    return false
  }
}

// ── Tipos — camelCase para refletir transform: postgres.camel ─────────────────
export interface Usuario {
  id:          string
  clienteId:   string
  email:       string
  nome:        string
  telefone:    string
  role:        UserRole
  ativo:       boolean
  ultimoLogin: string | null
  createdAt:   string
  empresaIds:  number[]   // postos vinculados a este usuário
}

export interface CreateUsuarioInput {
  cliente_id:  string
  email:       string
  nome:        string
  telefone:    string
  role:        UserRole
  senha:       string
  empresa_ids: number[]   // postos que o usuário pode acessar
}

// ── Queries ──────────────────────────────────────────────────────────────────
export async function listUsuariosByCliente(clienteId: string): Promise<Usuario[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      u.id, u.cliente_id, u.email, u.nome, u.telefone, u.role,
      u.ativo, u.ultimo_login, u.created_at,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(ue.empresa_id ORDER BY ue.empresa_id), NULL),
        '{}'::bigint[]
      ) AS empresa_ids
    FROM   usuarios u
    LEFT JOIN usuario_empresas ue ON ue.usuario_id = u.id
    WHERE  u.cliente_id = ${clienteId}
    GROUP  BY u.id
    ORDER  BY u.nome
  `
  return rows as unknown as Usuario[]
}

export async function findUsuarioByEmailGlobal(email: string): Promise<(Usuario & { senhaHash: string }) | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      u.id, u.cliente_id, u.email, u.nome, u.telefone, u.role,
      u.ativo, u.ultimo_login, u.created_at, u.senha_hash,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(ue.empresa_id ORDER BY ue.empresa_id), NULL),
        '{}'::bigint[]
      ) AS empresa_ids
    FROM   usuarios u
    LEFT JOIN usuario_empresas ue ON ue.usuario_id = u.id
    WHERE  u.email = ${email.toLowerCase()}
    AND    u.ativo = true
    GROUP  BY u.id
    ORDER  BY u.created_at DESC
    LIMIT  1
  `
  return (rows[0] as unknown as (Usuario & { senhaHash: string })) ?? null
}

export async function createUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  const sql = getDb()
  const senhaHash = hashPassword(input.senha)

  const usuario = await sql.begin(async (tx) => {
    const [row] = await tx`
      INSERT INTO usuarios (cliente_id, email, nome, telefone, role, senha_hash)
      VALUES (
        ${input.cliente_id},
        ${input.email.toLowerCase()},
        ${input.nome},
        ${input.telefone},
        ${input.role},
        ${senhaHash}
      )
      RETURNING id, cliente_id, email, nome, telefone, role, ativo, ultimo_login, created_at
    `

    // Vincula o usuário aos postos escolhidos
    if (input.empresa_ids.length > 0) {
      await tx`
        INSERT INTO usuario_empresas (usuario_id, empresa_id)
        SELECT ${row.id}, unnest(${input.empresa_ids}::bigint[])
      `
    }

    return { ...row, empresa_ids: input.empresa_ids }
  })

  return usuario as unknown as Usuario
}

export async function updateUltimoLogin(userId: string): Promise<void> {
  const sql = getDb()
  await sql`UPDATE usuarios SET ultimo_login = NOW() WHERE id = ${userId}`
}

export async function deactivateUsuario(userId: string, clienteId: string): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE usuarios SET ativo = false
    WHERE  id = ${userId} AND cliente_id = ${clienteId}
  `
}
