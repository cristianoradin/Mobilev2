import { NextRequest, NextResponse } from 'next/server'
import { generateUserJWT } from '@/lib/jwt'
import { findUsuarioByEmailGlobal, updateUltimoLogin, verifyPassword } from '@/lib/repositories/usuarios'
import { findClienteSafe } from '@/lib/repositories/clientes'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return NextResponse.json({ error: 'E-mail e senha obrigatórios' }, { status: 400 })
    }

    // Busca usuário no banco
    const user = await findUsuarioByEmailGlobal(email)

    if (!user || !verifyPassword(senha, user.senhaHash)) {
      await new Promise(r => setTimeout(r, 300)) // throttle brute-force
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Busca cliente e empresas
    const cliente = await findClienteSafe(user.clienteId)
    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ error: 'Cliente inativo ou não encontrado' }, { status: 403 })
    }

    // Atualiza último login em background
    updateUltimoLogin(user.id).catch(() => {})

    const empresas = cliente.empresas.map(e => e.id)
    const jwt = await generateUserJWT(user.id, user.role, user.clienteId, cliente.cnpj, empresas)

    return NextResponse.json({
      id:         user.id,
      nome:       user.nome,
      email:      user.email,
      role:       user.role,
      cliente_id: user.clienteId,
      cnpj:       cliente.cnpj,
      empresas:   cliente.empresas,
      jwt,
      expires_at: Date.now() + 8 * 60 * 60 * 1000, // 8h
    })
  } catch (err) {
    console.error('[pwa-login]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
