import { NextRequest, NextResponse } from 'next/server'
import { generateUserJWT } from '@/lib/jwt'
import { MOCK_CLIENTES } from '@/lib/types'

// Usuários mock — em produção: busca na tabela `usuarios` + bcrypt.compare
const MOCK_USERS = [
  {
    id: 'usr-001', nome: 'João Silva', email: 'joao@posto.com.br',
    senha: 'sga123', role: 'dono' as const, cliente_id: 'cli-001',
  },
  {
    id: 'usr-002', nome: 'Maria Operadora', email: 'maria@posto.com.br',
    senha: 'sga123', role: 'operador' as const, cliente_id: 'cli-001',
  },
  {
    id: 'usr-003', nome: 'Carlos Gerente', email: 'carlos@petrosul.com.br',
    senha: 'sga123', role: 'gerente' as const, cliente_id: 'cli-002',
  },
]

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return NextResponse.json({ error: 'E-mail e senha obrigatórios' }, { status: 400 })
    }

    const user = MOCK_USERS.find(u => u.email === email && u.senha === senha)
    if (!user) {
      await new Promise(r => setTimeout(r, 300)) // throttle
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const cliente = MOCK_CLIENTES.find(c => c.id === user.cliente_id)
    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ error: 'Cliente inativo ou não encontrado' }, { status: 403 })
    }

    const empresas = cliente.empresas.map(e => e.id)
    const jwt = await generateUserJWT(user.id, user.role, user.cliente_id, cliente.cnpj, empresas)

    return NextResponse.json({
      id:         user.id,
      nome:       user.nome,
      email:      user.email,
      role:       user.role,
      cliente_id: user.cliente_id,
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
