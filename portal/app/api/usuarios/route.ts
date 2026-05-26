import { NextRequest, NextResponse } from 'next/server'
import {
  listAllUsuarios,
  createUsuario,
  emailExistsGlobal,
} from '@/lib/repositories/usuarios'
import type { UserRole } from '@/lib/types'

// GET /api/usuarios — lista todos os usuários mobile de todos os clientes
export async function GET() {
  try {
    const usuarios = await listAllUsuarios()
    return NextResponse.json({ usuarios })
  } catch (err) {
    console.error('[GET /api/usuarios]', err)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

// POST /api/usuarios — cria novo usuário mobile (email globalmente único)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      cliente_id:  string
      nome:        string
      email:       string
      telefone?:   string
      role:        UserRole
      senha:       string
      empresa_ids: number[]
    }

    const { cliente_id, nome, email, role, senha } = body
    const telefone   = body.telefone  ?? ''
    const empresa_ids = Array.isArray(body.empresa_ids) ? body.empresa_ids : []

    if (!cliente_id?.trim()) return NextResponse.json({ error: 'Cliente obrigatório' },  { status: 400 })
    if (!nome?.trim())       return NextResponse.json({ error: 'Nome obrigatório' },     { status: 400 })
    if (!email?.trim())      return NextResponse.json({ error: 'E-mail obrigatório' },   { status: 400 })
    if (!senha?.trim())      return NextResponse.json({ error: 'Senha obrigatória' },    { status: 400 })
    if (senha.length < 6)    return NextResponse.json({ error: 'Senha mínima: 6 caracteres' }, { status: 400 })
    if (!['operador', 'gerente', 'dono'].includes(role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
    }

    // Verifica unicidade global do email antes de inserir
    const existe = await emailExistsGlobal(email.trim())
    if (existe) {
      return NextResponse.json(
        { error: 'E-mail já cadastrado — use "Liberar empresas" para dar acesso a mais postos' },
        { status: 409 }
      )
    }

    const usuario = await createUsuario({
      cliente_id,
      nome:        nome.trim(),
      email:       email.trim(),
      telefone:    telefone.trim(),
      role,
      senha,
      empresa_ids,
    })

    return NextResponse.json({ usuario }, { status: 201 })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
    console.error('[POST /api/usuarios]', err)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}
