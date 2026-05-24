import { NextRequest, NextResponse } from 'next/server'
import { findDonoByClienteId } from '@/lib/repositories/usuarios'
import { findClienteSafe }     from '@/lib/repositories/clientes'
import { generateUserJWT }     from '@/lib/jwt'

/**
 * GET /api/pwa-preview/session?cliente_id=UUID
 *
 * Gera uma sessão PWA para o usuário "dono" de um cliente, sem precisar
 * de senha. Usado exclusivamente pela página de preview do portal.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get('cliente_id')
    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const [user, cliente] = await Promise.all([
      findDonoByClienteId(clienteId),
      findClienteSafe(clienteId),
    ])

    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ error: 'Cliente não encontrado ou inativo' }, { status: 404 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Nenhum usuário "dono" encontrado para este cliente' }, { status: 404 })
    }

    const todasEmpresas  = cliente.empresas
    const empresasDoUser = user.role === 'dono' || user.empresaIds.length === 0
      ? todasEmpresas
      : todasEmpresas.filter(e => user.empresaIds.includes(e.id))

    const empresaIds = empresasDoUser.map(e => e.id)
    const jwt = await generateUserJWT(user.id, user.role, user.clienteId, cliente.cnpj, empresaIds)

    return NextResponse.json({
      id:         user.id,
      nome:       user.nome,
      email:      user.email,
      role:       user.role,
      cliente_id: user.clienteId,
      cnpj:       cliente.cnpj,
      empresas:   empresasDoUser,
      jwt,
      expires_at: Date.now() + 8 * 60 * 60 * 1000, // 8h
    })
  } catch (err) {
    console.error('[pwa-preview/session]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
