/**
 * GET /api/graficos/liberacoes
 * Retorna o estado de liberação de todos os templates.
 * { liberacoes: Record<templateKey, { is_publico, cliente_ids }> }
 */
import { NextResponse } from 'next/server'
import { getAllTemplateLiberacoes } from '@/lib/repositories/liberacoes'

export async function GET() {
  try {
    const liberacoes = await getAllTemplateLiberacoes()
    // Serializa para o formato que o frontend espera
    const out: Record<string, { is_publico: boolean; cliente_ids: string[] }> = {}
    for (const [key, val] of Object.entries(liberacoes)) {
      out[key] = { is_publico: val.isPublico, cliente_ids: val.clienteIds }
    }
    return NextResponse.json({ liberacoes: out })
  } catch (err) {
    console.error('[graficos/liberacoes GET]', err)
    return NextResponse.json({ liberacoes: {} })
  }
}
