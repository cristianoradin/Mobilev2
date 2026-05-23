import { SignJWT, importPKCS8, generateKeyPair, exportSPKI } from 'jose'
import type { Cliente } from './types'

// Em produção: chaves RSA geradas por cliente e armazenadas no banco
// Aqui usamos HS256 como fallback de desenvolvimento até a infra de chaves estar pronta
const DEV_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

export async function generateAgentJWT(cliente: Cliente): Promise<string> {
  const privateKeyPem = process.env.JWT_PRIVATE_KEY

  if (privateKeyPem) {
    // Produção: assina com RS256 usando a chave privada do servidor
    const privateKey = await importPKCS8(privateKeyPem, 'RS256')
    return new SignJWT({
      cnpj:     cliente.cnpj,
      empresas: cliente.empresas.map(e => e.id),
      plano:    cliente.plano,
      type:     'agent_token',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(cliente.id)
      .setIssuedAt()
      .setExpirationTime('365d')
      .setIssuer('sgapetro.cloud')
      .sign(privateKey)
  }

  // Desenvolvimento: HS256 temporário
  return new SignJWT({
    cnpj:     cliente.cnpj,
    empresas: cliente.empresas.map(e => e.id),
    plano:    cliente.plano,
    type:     'agent_token',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(cliente.id)
    .setIssuedAt()
    .setExpirationTime('365d')
    .setIssuer('sgapetro.cloud')
    .sign(DEV_SECRET)
}

export async function generateUserJWT(userId: string, role: string, clienteId: string, cnpj: string, empresas: number[]): Promise<string> {
  return new SignJWT({
    client_id: clienteId,
    cnpj,
    role,
    empresas,
    type: 'user_token',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('8h')
    .setIssuer('sgapetro.cloud')
    .sign(DEV_SECRET)
}

export async function generateRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const pub = await exportSPKI(publicKey)
  const { exportPKCS8 } = await import('jose')
  const priv = await exportPKCS8(privateKey)
  return { publicKey: pub, privateKey: priv }
}
