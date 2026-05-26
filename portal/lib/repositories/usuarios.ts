import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { getDb } from '@/lib/db'
import type { UserRole } from '@/lib/types'

export interface UsuarioGlobal extends Usuario {
  clienteNome: string
  clienteCnpj: string
  empresas:    { id: number; nome: string }[]
}

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
  id:           string
  clienteId:    string
  email:        string
  nome:         string
  telefone:     string
  role:         UserRole
  ativo:        boolean
  ultimoLogin:  string | null
  createdAt:    string
  empresaIds:   number[]   // postos vinculados a este usuário
  tokenVersion: number
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
      COALESCE(u.token_version, 1) AS token_version,
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

export async function incrementTokenVersion(userId: string): Promise<void> {
  const sql = getDb()
  await sql`UPDATE usuarios SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ${userId}`
}

export async function getTokenVersion(userId: string): Promise<number | null> {
  const sql = getDb()
  const rows = await sql`SELECT COALESCE(token_version, 1) AS token_version FROM usuarios WHERE id = ${userId} AND ativo = true`
  return rows[0] ? (rows[0].tokenVersion as number) : null
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

export async function findDonoByClienteId(clienteId: string): Promise<Usuario | null> {
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
    AND    u.role = 'dono'
    AND    u.ativo = true
    GROUP  BY u.id
    ORDER  BY u.created_at ASC
    LIMIT  1
  `
  return (rows[0] as unknown as Usuario) ?? null
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

// ── Gestão global de usuários mobile ─────────────────────────────────────────

export async function listAllUsuarios(): Promise<UsuarioGlobal[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      u.id, u.cliente_id, u.email, u.nome, u.telefone, u.role,
      u.ativo, u.ultimo_login, u.created_at,
      c.nome  AS cliente_nome,
      c.cnpj  AS cliente_cnpj,
      COALESCE(
        json_agg(
          json_build_object('id', e.id, 'nome', e.nome)
          ORDER BY e.nome
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS empresas
    FROM   usuarios u
    JOIN   clientes c ON c.id = u.cliente_id
    LEFT JOIN usuario_empresas ue ON ue.usuario_id = u.id
    LEFT JOIN empresas e          ON e.id = ue.empresa_id
    GROUP  BY u.id, c.nome, c.cnpj
    ORDER  BY c.nome, u.nome
  `
  return rows.map(r => ({
    ...r,
    clienteNome: r.clienteNome ?? r.cliente_nome,
    clienteCnpj: r.clienteCnpj ?? r.cliente_cnpj,
    ultimoLogin: r.ultimoLogin ?? r.ultimo_login ?? null,
    createdAt:   r.createdAt   ?? r.created_at,
    empresaIds:  (r.empresas as { id: number }[]).map(e => e.id),
    empresas:    r.empresas,
  })) as unknown as UsuarioGlobal[]
}

export async function emailExistsGlobal(email: string, excludeId?: string): Promise<boolean> {
  const sql = getDb()
  const rows = excludeId
    ? await sql`SELECT 1 FROM usuarios WHERE lower(email) = lower(${email}) AND id <> ${excludeId}::uuid LIMIT 1`
    : await sql`SELECT 1 FROM usuarios WHERE lower(email) = lower(${email}) LIMIT 1`
  return rows.length > 0
}

export async function updateUsuario(
  id: string,
  updates: { nome?: string; telefone?: string; role?: UserRole; ativo?: boolean; senha?: string }
): Promise<void> {
  const sql = getDb()
  const sets: string[] = []

  if (updates.nome      !== undefined) await sql`UPDATE usuarios SET nome      = ${updates.nome}      WHERE id = ${id}::uuid`
  if (updates.telefone  !== undefined) await sql`UPDATE usuarios SET telefone  = ${updates.telefone}  WHERE id = ${id}::uuid`
  if (updates.role      !== undefined) await sql`UPDATE usuarios SET role      = ${updates.role}      WHERE id = ${id}::uuid`
  if (updates.ativo     !== undefined) await sql`UPDATE usuarios SET ativo     = ${updates.ativo}     WHERE id = ${id}::uuid`
  if (updates.senha) {
    const hash = hashPassword(updates.senha)
    await sql`UPDATE usuarios SET senha_hash = ${hash} WHERE id = ${id}::uuid`
  }
  void sets // só para evitar unused warning
}

export async function setEmpresasForUsuario(userId: string, empresaIds: number[]): Promise<void> {
  const sql = getDb()
  await sql.begin(async tx => {
    await tx`DELETE FROM usuario_empresas WHERE usuario_id = ${userId}::uuid`
    if (empresaIds.length > 0) {
      await tx`
        INSERT INTO usuario_empresas (usuario_id, empresa_id)
        SELECT ${userId}::uuid, unnest(${empresaIds}::bigint[])
        ON CONFLICT DO NOTHING
      `
    }
  })
}

export async function deleteUsuarioGlobal(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM usuarios WHERE id = ${id}::uuid`
}
