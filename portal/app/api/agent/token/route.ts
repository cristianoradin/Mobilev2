import { NextRequest, NextResponse } from 'next/server'
import { generateAgentJWT } from '@/lib/jwt'
import { findClienteSafe } from '@/lib/repositories/clientes'

export async function POST(req: NextRequest) {
  try {
    const { cliente_id } = await req.json()

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })
    }

    const cliente = await findClienteSafe(cliente_id)
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    if (!cliente.ativo) {
      return NextResponse.json({ error: 'Cliente inativo' }, { status: 403 })
    }

    const token = await generateAgentJWT(cliente)
    return NextResponse.json({ token, cliente_id, expires_in: '365d' })
  } catch (err) {
    console.error('[agent/token] Erro:', err)
    return NextResponse.json({ error: 'Erro interno ao gerar token' }, { status: 500 })
  }
}
