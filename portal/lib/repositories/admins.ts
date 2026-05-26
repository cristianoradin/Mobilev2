/**
 * Repository dos admins do portal.
 * Reusa hashPassword/verifyPassword do repo de usuários.
 */
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/repositories/usuarios'

export interface Admin {
  id:         string
  email:      string
  nome:       string
  ativo:      boolean
  createdAt:  string
}

export async function listAdmins(): Promise<Admin[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, email, nome, ativo, created_at
    FROM admins
    ORDER BY created_at DESC
  `
  return rows.map(r => ({
    id:        String(r.id),
    email:     String(r.email),
    nome:      String(r.nome),
    ativo:     Boolean(r.ativo),
    createdAt: String(r.createdAt),
  }))
}

export async function getAdmin(id: string): Promise<Admin | null> {
  const sql = getDb()
  const [r] = await sql`
    SELECT id, email, nome, ativo, created_at
    FROM admins WHERE id = ${id}
  `
  if (!r) return null
  return {
    id:        String(r.id),
    email:     String(r.email),
    nome:      String(r.nome),
    ativo:     Boolean(r.ativo),
    createdAt: String(r.createdAt),
  }
}

export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const sql = getDb()
  const [r] = await sql`
    SELECT id, email, nome, ativo, created_at
    FROM admins WHERE LOWER(email) = LOWER(${email})
  `
  if (!r) return null
  return {
    id:        String(r.id),
    email:     String(r.email),
    nome:      String(r.nome),
    ativo:     Boolean(r.ativo),
    createdAt: String(r.createdAt),
  }
}

export async function createAdmin(input: { nome: string; email: string; senha: string }): Promise<Admin> {
  const sql = getDb()
  const hash = hashPassword(input.senha)
  const [r] = await sql`
    INSERT INTO admins (email, nome, senha_hash, ativo)
    VALUES (${input.email}, ${input.nome}, ${hash}, true)
    RETURNING id, email, nome, ativo, created_at
  `
  return {
    id:        String(r.id),
    email:     String(r.email),
    nome:      String(r.nome),
    ativo:     Boolean(r.ativo),
    createdAt: String(r.createdAt),
  }
}

export async function updateAdmin(
  id: string,
  patch: { nome?: string; email?: string; ativo?: boolean },
): Promise<Admin | null> {
  const sql = getDb()
  // Construção dinâmica do SET de forma segura via tag template
  if (patch.nome !== undefined) await sql`UPDATE admins SET nome  = ${patch.nome}  WHERE id = ${id}`
  if (patch.email !== undefined) await sql`UPDATE admins SET email = ${patch.email} WHERE id = ${id}`
  if (patch.ativo !== undefined) await sql`UPDATE admins SET ativo = ${patch.ativo} WHERE id = ${id}`
  return getAdmin(id)
}

export async function resetAdminPassword(id: string, novaSenha: string): Promise<boolean> {
  const sql = getDb()
  const hash = hashPassword(novaSenha)
  const res = await sql`UPDATE admins SET senha_hash = ${hash} WHERE id = ${id}`
  return res.count > 0
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const sql = getDb()
  const res = await sql`DELETE FROM admins WHERE id = ${id}`
  return res.count > 0
}
