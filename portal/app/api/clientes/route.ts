import { NextRequest, NextResponse } from 'next/server'
import { listClientesSafe, createClienteSafe } from '@/lib/repositories/clientes'
import type { Plano } from '@/lib/types'

export async function GET() {
  const clientes = await listClientesSafe()
  return NextResponse.json({ clientes, total: clientes.length })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { nome, cnpj, email, telefone, plano, empresa_nome, empresa_cnpj } = body as {
      nome:          string
      cnpj:          string
      email:         string
      telefone?:     string
      plano:         Plano
      empresa_nome:  string
      empresa_cnpj?: string
    }

    // Validação básica
    if (!nome?.trim())         return NextResponse.json({ error: 'Nome é obrigatório' },         { status: 400 })
    if (!cnpj?.trim())         return NextResponse.json({ error: 'CNPJ é obrigatório' },         { status: 400 })
    if (!email?.trim())        return NextResponse.json({ error: 'E-mail é obrigatório' },       { status: 400 })
    if (!empresa_nome?.trim()) return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 })
    if (!['basic','pro','enterprise'].includes(plano)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const cliente = await createClienteSafe({
      nome:          nome.trim(),
      cnpj:          cnpj.trim(),
      email:         email.trim(),
      telefone:      telefone?.trim() || undefined,
      plano,
      empresa_nome:  empresa_nome.trim(),
      empresa_cnpj:  empresa_cnpj?.trim() || undefined,
    })

    return NextResponse.json({ cliente }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    // Violação de unique (cnpj ou email já existe)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'CNPJ ou e-mail já cadastrado' }, { status: 409 })
    }

    console.error('[POST /api/clientes]', err)
    return NextResponse.json({ error: 'Erro interno ao criar cliente' }, { status: 500 })
  }
}
