import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'sga_session'
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sga-petro-dev-secret-change-in-production-min-32-chars'
)

export interface AdminSession {
  id?:                string
  email:              string
  nome:               string
  role:               'admin'
  is_master:          boolean
  menus_permitidos:   string[]
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
      id:               payload.id    as string | undefined,
      email:            payload.email as string,
      nome:             payload.nome  as string,
      role:             'admin',
      is_master:        (payload.is_master as boolean) ?? false,
      menus_permitidos: (payload.menus_permitidos as string[]) ?? [],
    }
  } catch {
    return null
  }
}

export { SESSION_COOKIE }
