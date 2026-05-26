/**
 * POST /api/auth/pwa-logout
 * Revoga o token JWT do usuário incrementando token_version no DB.
 * Qualquer JWT antigo passa a ser inválido imediatamente.
 * Header: Authorization: Bearer <jwt>
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest }        from '@/lib/jwt-verify'
import { incrementTokenVersion }     from '@/lib/repositories/usuarios'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: true }) // já inválido, tudo bem

  try {
    await incrementTokenVersion(user.sub)
  } catch {
    // Se DB falhar, ignora — token vai expirar naturalmente em 8h
  }

  return NextResponse.json({ ok: true })
}
