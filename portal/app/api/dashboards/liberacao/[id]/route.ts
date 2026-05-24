/**
 * PUT /api/dashboards/liberacao/[id]
 * Body: { is_publico: boolean, cliente_ids: string[] }
 *
 * Funciona para dashboards do sistema (dash-001, …) e criados pelo usuário.
 * Sistema → salva em dashboard_liberacoes (key = id)
 * Usuário → salva em dashboards.is_publico / dashboards.cliente_ids
 */
import { NextRequest, NextResponse } from 'next/server'
import { setDashboardLiberacaoByKey, setDashboardLiberacao } from '@/lib/repositories/liberacoes'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json() as { is_publico: boolean; cliente_ids: string[] }
    const isPublico  = Boolean(body.is_publico)
    const clienteIds = body.cliente_ids ?? []

    if (id.startsWith('dash-')) {
      // Dashboard do sistema — persiste na tabela dashboard_liberacoes
      await setDashboardLiberacaoByKey(id, isPublico, clienteIds)
    } else {
      // Dashboard criado pelo usuário — persiste direto na tabela dashboards
      await setDashboardLiberacao(id, isPublico, clienteIds)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[dashboards/liberacao PUT]', err)
    return NextResponse.json({ error: 'Erro ao salvar liberação' }, { status: 500 })
  }
}
