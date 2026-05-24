/**
 * GET  /api/portal-usuarios  — lista admins do portal
 * POST /api/portal-usuarios  — cria novo admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb }          from '@/lib/db'
import { hashPassword }   from '@/lib/repositories/usuarios'
import { ALL_MENUS }      from '@/app/api/auth/login/route'

export async function GET() {
  try {
    const sql  = getDb()
    const rows = await sql`
      SELECT id, email, nome, is_master, menus_permitidos, ativo, created_at
      FROM   admins
      ORDER  BY is_master DESC, nome
    `
    return NextResponse.json({ usuarios: rows })
  } catch (err) {
    console.error('[portal-usuarios GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email:            string
      nome:             string
      senha:            string
      menus_permitidos: string[]
    }

    if (!body.email?.trim() || !body.nome?.trim() || !body.senha?.trim()) {
      return NextResponse.json({ error: 'email, nome e senha são obrigatórios' }, { status: 400 })
    }

    // Valida menus
    const menus = (body.menus_permitidos ?? []).filter(m => ALL_MENUS.includes(m))

    const sql        = getDb()
    const senhaHash  = hashPassword(body.senha)

    const [row] = await sql`
      INSERT INTO admins (email, nome, senha_hash, is_master, menus_permitidos)
      VALUES (
        ${body.email.toLowerCase().trim()},
        ${body.nome.trim()},
        ${senhaHash},
        false,
        ${menus}
      )
      RETURNING id, email, nome, is_master, menus_permitidos, ativo, created_at
    `
    return NextResponse.json({ ok: true, usuario: row }, { status: 201 })
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as {code: string}).code === '23505') {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
    console.error('[portal-usuarios POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
