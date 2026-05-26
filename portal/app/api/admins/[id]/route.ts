/**
 * GET    /api/admins/[id]
 * PATCH  /api/admins/[id]   — { nome?, email?, ativo? }
 * DELETE /api/admins/[id]
 * Protegido por sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { getAdmin, updateAdmin, deleteAdmin, getAdminByEmail } from '@/lib/repositories/admins'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  return token ? await verifySessionToken(token) : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const admin = await getAdmin(id)
  if (!admin) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ admin })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const existing = await getAdmin(id)
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  let body: { nome?: string; email?: string; ativo?: boolean } = {}
  try { body = await req.json() } catch { /* invalid */ }

  const patch: typeof body = {}
  if (body.nome  !== undefined) patch.nome  = String(body.nome).trim()
  if (body.email !== undefined) {
    const e = String(body.email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json({ error: 'email inválido' }, { status: 400 })
    }
    if (e !== existing.email.toLowerCase()) {
      const conflict = await getAdminByEmail(e)
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: 'email já em uso' }, { status: 409 })
      }
    }
    patch.email = e
  }
  if (body.ativo !== undefined) {
    // Impede desativar a si mesmo (perde acesso imediato)
    if (s.id === id && body.ativo === false) {
      return NextResponse.json({ error: 'Não pode desativar seu próprio acesso' }, { status: 400 })
    }
    patch.ativo = Boolean(body.ativo)
  }

  try {
    const updated = await updateAdmin(id, patch)
    void writeAudit(req, { acao: 'admin.update', recurso: existing.email, status: 'ok', payload: { patch } })
    return NextResponse.json({ admin: updated })
  } catch (err) {
    console.error('[admins PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  if (s.id === id) {
    return NextResponse.json({ error: 'Não pode excluir a si mesmo' }, { status: 400 })
  }

  const existing = await getAdmin(id)
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  try {
    await deleteAdmin(id)
    void writeAudit(req, { acao: 'admin.delete', recurso: existing.email, status: 'ok' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admins DELETE]', err)
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 })
  }
}
