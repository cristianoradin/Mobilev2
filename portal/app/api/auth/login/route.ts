import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE, type AdminSession } from '@/lib/session'

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@sgapetro.cloud'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'sga@admin2026'
const ADMIN_NOME     = process.env.ADMIN_NOME     ?? 'Admin SGA'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenciais obrigatórias' }, { status: 400 })
    }

    // Comparação em tempo constante (previne timing attacks)
    const emailOk    = timingSafeEqual(email,    ADMIN_EMAIL)
    const passwordOk = timingSafeEqual(password, ADMIN_PASSWORD)

    if (!emailOk || !passwordOk) {
      await new Promise(r => setTimeout(r, 300)) // throttle brute-force
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const session: AdminSession = { email: ADMIN_EMAIL, nome: ADMIN_NOME, role: 'admin' }
    const token = await createSessionToken(session)

    const res = NextResponse.json({ ok: true, nome: ADMIN_NOME })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   8 * 60 * 60, // 8h
      path:     '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
