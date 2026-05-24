/**
 * PATCH /api/licencas/[id]  — atualiza licença (renovar, suspender, reativar)
 * DELETE /api/licencas/[id] — remove licença
 * POST /api/licencas        — cria nova licença (ver route.ts pai)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body   = await req.json() as {
      ativa?:          boolean
      plano?:          string
      max_usuarios?:   number
      max_graficos?:   number
      data_expiracao?: string | null
    }
    const sql = getDb()

    await sql`
      UPDATE licencas SET
        ativa           = COALESCE(${body.ativa           ?? null}::boolean,        ativa),
        plano           = COALESCE(${body.plano           ?? null},                 plano),
        max_usuarios    = COALESCE(${body.max_usuarios    ?? null}::int,            max_usuarios),
        max_graficos    = COALESCE(${body.max_graficos    ?? null}::int,            max_graficos),
        data_expiracao  = CASE
          WHEN ${body.data_expiracao !== undefined}
          THEN ${body.data_expiracao ?? null}::timestamptz
          ELSE data_expiracao
        END
      WHERE id = ${id}::uuid
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/licencas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql    = getDb()
    await sql`DELETE FROM licencas WHERE id = ${id}::uuid`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/licencas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
