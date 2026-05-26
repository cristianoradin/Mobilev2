/**
 * POST /api/empresas-descobertas/[id]/vincular
 *
 * Modos:
 *  - { empresa_id: number }       — vincula a empresa portal existente (atualiza codigo_erp)
 *  - { criar_nova: true }         — cria empresa portal nova e vincula
 *
 * Auth: sessão de admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Body {
  empresa_id?: number
  criar_nova?: boolean
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const descobertaId = Number(id)
  if (!Number.isFinite(descobertaId)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  let body: Body = {}
  try { body = await req.json() } catch { /* invalid */ }

  if (!body.empresa_id && !body.criar_nova) {
    return NextResponse.json({ error: 'empresa_id ou criar_nova obrigatório' }, { status: 400 })
  }

  try {
    const sql = getDb()

    const [descoberta] = await sql`
      SELECT id, cliente_id, empcodigo, empnome, empcnpj_clean
      FROM empresas_descobertas
      WHERE id = ${descobertaId}
      LIMIT 1
    `
    if (!descoberta) return NextResponse.json({ error: 'Descoberta não encontrada' }, { status: 404 })

    let empresaId: number

    if (body.criar_nova) {
      // Cria nova empresa no portal, master se cliente ainda não tiver nenhuma
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM empresas WHERE cliente_id = ${descoberta.clienteId}::uuid
      `
      const isMaster = Number(count) === 0
      const [nova] = await sql`
        INSERT INTO empresas (cliente_id, nome, cnpj_filial, is_master, codigo_erp, ativo)
        VALUES (
          ${descoberta.clienteId}::uuid,
          ${descoberta.empnome},
          ${descoberta.empcnpjClean ?? null},
          ${isMaster},
          ${descoberta.empcodigo},
          true
        )
        RETURNING id
      `
      empresaId = Number(nova.id)
    } else {
      empresaId = Number(body.empresa_id)
      // Atualiza codigo_erp na empresa portal (substitui valor antigo se diferente)
      await sql`
        UPDATE empresas
           SET codigo_erp = ${descoberta.empcodigo}
         WHERE id = ${empresaId}
      `
    }

    // Marca a descoberta como vinculada
    await sql`
      UPDATE empresas_descobertas
         SET vinculada_empresa_id = ${empresaId}
       WHERE id = ${descobertaId}
    `

    return NextResponse.json({ ok: true, empresa_id: empresaId })
  } catch (err) {
    console.error('[vincular]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/empresas-descobertas/[id]/vincular
 * Desvincula (mantém descoberta + empresa portal, só zera o link).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jar     = await cookies()
  const token   = jar.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const sql = getDb()

  await sql`UPDATE empresas_descobertas SET vinculada_empresa_id = NULL WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
