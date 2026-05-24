/**
 * PATCH  /api/portal-usuarios/[id]  — atualiza dados / menus / senha
 * DELETE /api/portal-usuarios/[id]  — remove (bloqueado para is_master)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb }          from '@/lib/db'
import { hashPassword }   from '@/lib/repositories/usuarios'
import { ALL_MENUS }      from '@/app/api/auth/login/route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const body = await req.json() as {
      nome?:             string
      senha?:            string
      menus_permitidos?: string[]
      ativo?:            boolean
    }

    const sql = getDb()

    // Verifica existência e status master
    const [existing] = await sql`SELECT is_master FROM admins WHERE id = ${id}`
    if (!existing) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Executa updates individualmente (postgres.js não tem update dinâmico tipado)
    if (body.nome !== undefined) {
      await sql`UPDATE admins SET nome = ${body.nome.trim()} WHERE id = ${id}`
    }
    if (body.ativo !== undefined) {
      await sql`UPDATE admins SET ativo = ${body.ativo} WHERE id = ${id}`
    }
    if (body.senha?.trim()) {
      const h = hashPassword(body.senha)
      await sql`UPDATE admins SET senha_hash = ${h} WHERE id = ${id}`
    }
    if (body.menus_permitidos !== undefined && !existing.isMaster) {
      const menus = (body.menus_permitidos ?? []).filter(m => ALL_MENUS.includes(m))
      await sql`UPDATE admins SET menus_permitidos = ${menus} WHERE id = ${id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[portal-usuarios PATCH]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sql = getDb()

    const [row] = await sql`SELECT is_master FROM admins WHERE id = ${id}`
    if (!row)          return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (row.isMaster)  return NextResponse.json({ error: 'Usuário master não pode ser removido' }, { status: 403 })

    await sql`DELETE FROM admins WHERE id = ${id} AND is_master = false`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[portal-usuarios DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
