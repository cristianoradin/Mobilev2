/**
 * POST /api/auth/heartbeat
 * Atualiza last_seen_at do admin autenticado (chamado a cada 2 min pelo frontend).
 */
import { NextResponse }                        from 'next/server'
import { cookies }                             from 'next/headers'
import { verifySessionToken, SESSION_COOKIE }  from '@/lib/session'
import { getDb }                               from '@/lib/db'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token       = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return NextResponse.json({ ok: false }, { status: 401 })

    const session = await verifySessionToken(token)
    if (!session) return NextResponse.json({ ok: false }, { status: 401 })

    const sql = getDb()

    if (session.id) {
      // JWT moderno — id presente
      await sql`UPDATE admins SET last_seen_at = NOW() WHERE id = ${session.id}::uuid`
    } else if (session.email) {
      // JWT antigo (sem id) — busca por email
      await sql`UPDATE admins SET last_seen_at = NOW() WHERE email = ${session.email.toLowerCase()}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[heartbeat]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
