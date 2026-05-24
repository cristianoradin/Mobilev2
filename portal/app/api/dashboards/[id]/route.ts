import { NextRequest, NextResponse } from 'next/server'
import { deleteDashboardDB } from '@/lib/repositories/liberacoes'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    await deleteDashboardDB(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/dashboards/[id]]', err)
    return NextResponse.json({ error: 'Erro ao excluir dashboard' }, { status: 500 })
  }
}
