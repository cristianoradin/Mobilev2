/**
 * GET  /api/admins  — lista todos
 * POST /api/admins  — cria { nome, email, senha }
 * Protegido por sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { listAdmins, createAdmin, getAdminByEmail } from '@/lib/repositories/admins'
import { verifySessionToken, SESSION_COOKIE }       from '@/lib/session'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  return token ? await verifySessionToken(token) : null
}

export async function GET() {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const admins = await listAdmins()
    return NextResponse.json({ admins })
  } catch (err) {
    console.error('[admins GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { nome?: string; email?: string; senha?: string } = {}
  try { body = await req.json() } catch { /* invalid */ }

  const nome  = (body.nome  ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const senha = body.senha  ?? ''

  if (!nome || !email || senha.length < 6) {
    return NextResponse.json({ error: 'nome, email e senha (6+) são obrigatórios' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  }
  if (await getAdminByEmail(email)) {
    return NextResponse.json({ error: 'já existe admin com este email' }, { status: 409 })
  }

  try {
    const admin = await createAdmin({ nome, email, senha })
    void writeAudit(req, { acao: 'admin.create', recurso: admin.email, status: 'ok' })
    return NextResponse.json({ admin }, { status: 201 })
  } catch (err) {
    console.error('[admins POST]', err)
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 })
  }
}
