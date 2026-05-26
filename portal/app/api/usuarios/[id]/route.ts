import { NextRequest, NextResponse } from 'next/server'
import {
  updateUsuario,
  setEmpresasForUsuario,
  deleteUsuarioGlobal,
} from '@/lib/repositories/usuarios'
import type { UserRole } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/usuarios/[id] — atualiza nome, role, ativo, senha e/ou empresas
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const body = await req.json() as {
      nome?:        string
      telefone?:    string
      role?:        UserRole
      ativo?:       boolean
      senha?:       string
      empresa_ids?: number[]
    }

    if (body.role && !['operador', 'gerente', 'dono'].includes(body.role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
    }
    if (body.senha !== undefined && body.senha.length > 0 && body.senha.length < 6) {
      return NextResponse.json({ error: 'Senha mínima: 6 caracteres' }, { status: 400 })
    }

    // Atualiza campos básicos (apenas os que vieram no body)
    const { empresa_ids, ...campos } = body
    const senhaParaAtualizar = campos.senha && campos.senha.length >= 6 ? campos.senha : undefined
    await updateUsuario(id, { ...campos, senha: senhaParaAtualizar })

    // Atualiza empresas se veio no body
    if (Array.isArray(empresa_ids)) {
      await setEmpresasForUsuario(id, empresa_ids)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
  }
}

// DELETE /api/usuarios/[id] — remove o usuário permanentemente
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await deleteUsuarioGlobal(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/usuarios/[id]]', err)
    return NextResponse.json({ error: 'Erro ao remover usuário' }, { status: 500 })
  }
}
