import { NextRequest, NextResponse } from 'next/server'
import { generateUserJWT } from '@/lib/jwt'
import { findUsuarioByEmailGlobal, updateUltimoLogin, verifyPassword } from '@/lib/repositories/usuarios'
import { findClienteSafe } from '@/lib/repositories/clientes'
import { rateLimit }       from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return NextResponse.json({ error: 'E-mail e senha obrigatórios' }, { status: 400 })
    }

    // Rate limit: 8 tentativas / 15 min por IP + 5 por email
    const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rlIp    = rateLimit(`pwa-login:ip:${ip}`,               8,  15 * 60_000)
    const rlEmail = rateLimit(`pwa-login:email:${email.toLowerCase()}`, 5, 15 * 60_000)

    if (!rlIp.ok || !rlEmail.ok) {
      const retryAfter = Math.ceil(Math.max(rlIp.retryAfterMs, rlEmail.retryAfterMs) / 1000)
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }

    // Busca usuário no banco
    const user = await findUsuarioByEmailGlobal(email)

    if (!user || !verifyPassword(senha, user.senhaHash)) {
      await new Promise(r => setTimeout(r, 300)) // throttle adicional
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Busca cliente e empresas
    const cliente = await findClienteSafe(user.clienteId)
    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ error: 'Cliente inativo ou não encontrado' }, { status: 403 })
    }

    // Atualiza último login em background
    updateUltimoLogin(user.id).catch(() => {})

    // Dono sempre acessa todos os postos; outros só os vinculados
    // Se não há nenhum vínculo (usuário antigo), libera todos como fallback
    const todasEmpresas  = cliente.empresas
    const empresasDoUser = user.role === 'dono' || user.empresaIds.length === 0
      ? todasEmpresas
      : todasEmpresas.filter(e => user.empresaIds.includes(e.id))

    // Usa codigo_erp (ID local do ERP) quando disponível, senão o ID do portal
    // postgres.js com transform.camel transforma codigo_erp → codigoErp nos JSONB retornados
    // O agente Go usa este ID para filtrar: WHERE vdaempresa IN (:empresas_filtradas)
    const empresaIds = empresasDoUser.map(e => {
      const emp = e as { id: number; codigoErp?: number; codigo_erp?: number }
      return emp.codigoErp ?? emp.codigo_erp ?? emp.id
    })
    const jwt = await generateUserJWT(user.id, user.role, user.clienteId, cliente.cnpj, empresaIds, user.tokenVersion ?? 1)

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
    console.error('[pwa-login]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
