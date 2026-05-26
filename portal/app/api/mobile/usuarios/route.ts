/**
 * API Mobile — Gestão de usuários pelo app
 * Requer JWT do usuário no header Authorization: Bearer <token>
 * Apenas role 'dono' pode criar/listar usuários
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest }                    from '@/lib/jwt-verify'
import { listUsuariosByCliente, createUsuario }  from '@/lib/repositories/usuarios'
import { findClienteSafe }                       from '@/lib/repositories/clientes'
import type { UserRole }                         from '@/lib/types'

// GET /api/mobile/usuarios
export async function GET(req: NextRequest) {
  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (payload.role !== 'dono' && payload.role !== 'gerente') {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  try {
    const usuarios = await listUsuariosByCliente(payload.client_id)
    const cliente  = await findClienteSafe(payload.client_id)
    return NextResponse.json({ usuarios, empresas: cliente?.empresas ?? [] })
  } catch (err) {
    console.error('[mobile/GET usuarios]', err)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

// POST /api/mobile/usuarios
export async function POST(req: NextRequest) {
  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (payload.role !== 'dono') {
    return NextResponse.json({ error: 'Apenas o proprietário pode criar usuários' }, { status: 403 })
  }

  try {
    const body = await req.json() as {
      nome: string; email: string; telefone: string
      role: UserRole; senha: string; empresa_ids: number[]
    }
    const { nome, email, telefone, role, senha } = body
    const empresa_ids: number[] = Array.isArray(body.empresa_ids) ? body.empresa_ids : []

    if (!nome?.trim())     return NextResponse.json({ error: 'Nome obrigatório' },     { status: 400 })
    if (!email?.trim())    return NextResponse.json({ error: 'E-mail obrigatório' },   { status: 400 })
    if (!telefone?.trim()) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
    if (!senha?.trim())    return NextResponse.json({ error: 'Senha obrigatória' },    { status: 400 })
    if (!['operador', 'gerente'].includes(role)) {
      return NextResponse.json({ error: 'Role inválida (operador ou gerente)' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }
    if (empresa_ids.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos um posto' }, { status: 400 })
    }

    const usuario = await createUsuario({
      cliente_id: payload.client_id,
      nome:       nome.trim(),
      email:      email.trim(),
      telefone:   telefone.trim(),
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
    console.error('[mobile/POST usuario]', err)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}
