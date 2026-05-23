import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'sga_session'
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

export interface AdminSession {
  email: string
  nome:  string
  role:  'admin'
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.email)
    .setIssuedAt()
    .setExpirationTime('8h')
    .setIssuer('sgapetro.cloud')
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: 'sgapetro.cloud' })
    return {
      email: payload.email as string,
      nome:  payload.nome  as string,
      role:  'admin',
    }
  } catch {
    return null
  }
}

export { SESSION_COOKIE }
