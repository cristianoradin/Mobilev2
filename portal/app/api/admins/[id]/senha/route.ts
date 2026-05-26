/**
 * POST /api/admins/[id]/senha  — { senha }
 * Reset de senha (sem precisar da senha atual — só admin pode chamar).
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { getAdmin, resetAdminPassword } from '@/lib/repositories/admins'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const existing = await getAdmin(id)
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  let body: { senha?: string } = {}
  try { body = await req.json() } catch { /* invalid */ }
  const senha = body.senha ?? ''
  if (senha.length < 6) {
    return NextResponse.json({ error: 'senha deve ter 6+ caracteres' }, { status: 400 })
  }

  try {
    const ok = await resetAdminPassword(id, senha)
    if (!ok) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    void writeAudit(req, { acao: 'admin.reset_password', recurso: existing.email, status: 'ok' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admins/senha POST]', err)
    return NextResponse.json({ error: 'Erro ao redefinir senha' }, { status: 500 })
  }
}
