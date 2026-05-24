/**
 * PUT /api/graficos/liberacao/[key]
 * Salva o estado de liberação de um template.
 *
 * - tmpl-XXX → sistema: salva em template_liberacoes
 * - UUID     → custom:  salva em graficos.is_publico + graficos.cliente_ids
 */
import { NextRequest, NextResponse } from 'next/server'
import { setTemplateLiberacao }  from '@/lib/repositories/liberacoes'
import { setGraficoLiberacao }   from '@/lib/repositories/graficos'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params
    const body = await req.json() as { is_publico: boolean; cliente_ids: string[] }
    const isPublico  = Boolean(body.is_publico)
    const clienteIds = body.cliente_ids ?? []

    if (key.startsWith('tmpl-')) {
      // Template do sistema → tabela template_liberacoes
      await setTemplateLiberacao(key, isPublico, clienteIds)
    } else {
      // Template customizado → coluna direta na tabela graficos
      await setGraficoLiberacao(key, isPublico, clienteIds)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[graficos/liberacao PUT]', err)
    return NextResponse.json({ error: 'Erro ao salvar liberação' }, { status: 500 })
  }
}
