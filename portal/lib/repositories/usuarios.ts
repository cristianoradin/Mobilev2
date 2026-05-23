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
}

export interface CreateUsuarioInput {
  cliente_id: string
  email:      string
  nome:       string
  telefone:   string
  role:       UserRole
  senha:      string
}

// ── Queries ──────────────────────────────────────────────────────────────────
export async function listUsuariosByCliente(clienteId: string): Promise<Usuario[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, cliente_id, email, nome, telefone, role, ativo, ultimo_login, created_at
    FROM   usuarios
    WHERE  cliente_id = ${clienteId}
    ORDER  BY nome
  `
  return rows as unknown as Usuario[]
}

export async function findUsuarioByEmailGlobal(email: string): Promise<(Usuario & { senhaHash: string }) | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, cliente_id, email, nome, telefone, role, ativo, ultimo_login, created_at, senha_hash
    FROM   usuarios
    WHERE  email = ${email.toLowerCase()}
    AND    ativo = true
    ORDER  BY created_at DESC
    LIMIT  1
  `
  return (rows[0] as unknown as (Usuario & { senhaHash: string })) ?? null
}

export async function createUsuario(input: CreateUsuarioInput): Promise<Usuario> {
  const sql = getDb()
  const senhaHash = hashPassword(input.senha)

  const rows = await sql`
    INSERT INTO usuarios (cliente_id, email, nome, telefone, role, senha_hash)
    VALUES (${input.cliente_id}, ${input.email.toLowerCase()}, ${input.nome}, ${input.telefone}, ${input.role}, ${senhaHash})
    RETURNING id, cliente_id, email, nome, telefone, role, ativo, ultimo_login, created_at
  `
  return rows[0] as unknown as Usuario
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
