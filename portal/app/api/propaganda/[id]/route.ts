/**
 * PATCH  /api/propaganda/[id]  — toggle ativa
 * DELETE /api/propaganda/[id]  — remove
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body   = await req.json() as { ativa?: boolean }
    const sql    = getDb()

    await sql`
      UPDATE propagandas SET ativa = ${body.ativa ?? false} WHERE id = ${id}::uuid
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[propaganda PATCH]', err)
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
    await sql`DELETE FROM propagandas WHERE id = ${id}::uuid`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[propaganda DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
