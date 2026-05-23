import { NextRequest, NextResponse } from 'next/server'
import {
  listUsuariosByCliente,
  createUsuario,
  deactivateUsuario,
} from '@/lib/repositories/usuarios'
import type { UserRole } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

// GET /api/clientes/[id]/usuarios
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const usuarios = await listUsuariosByCliente(id)
    return NextResponse.json({ usuarios })
  } catch (err) {
    console.error('[GET usuarios]', err)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

// POST /api/clientes/[id]/usuarios
export async function POST(req: NextRequest, { params }: Params) {
  const { id: cliente_id } = await params
  try {
    const body = await req.json() as { nome: string; email: string; telefone: string; role: UserRole; senha: string }
    const { nome, email, telefone, role, senha } = body

    if (!nome?.trim())     return NextResponse.json({ error: 'Nome obrigatório' },     { status: 400 })
    if (!email?.trim())    return NextResponse.json({ error: 'E-mail obrigatório' },   { status: 400 })
    if (!telefone?.trim()) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
    if (!senha?.trim())    return NextResponse.json({ error: 'Senha obrigatória' },    { status: 400 })
    if (!['operador', 'gerente', 'dono'].includes(role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const usuario = await createUsuario({ cliente_id, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), role, senha })
    return NextResponse.json({ usuario }, { status: 201 })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'E-mail já cadastrado para este cliente' }, { status: 409 })
    }
    console.error('[POST usuario]', err)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}

// DELETE /api/clientes/[id]/usuarios?usuario_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: cliente_id } = await params
  const usuario_id = req.nextUrl.searchParams.get('usuario_id')

  if (!usuario_id) {
    return NextResponse.json({ error: 'usuario_id obrigatório' }, { status: 400 })
  }

  try {
    await deactivateUsuario(usuario_id, cliente_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE usuario]', err)
    return NextResponse.json({ error: 'Erro ao desativar usuário' }, { status: 500 })
  }
}
