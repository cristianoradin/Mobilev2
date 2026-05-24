/**
 * GET /api/dashboards/liberacoes
 * Retorna o estado de liberação de todos os dashboards do sistema.
 */
import { NextResponse } from 'next/server'
import { getAllDashboardLiberacoes } from '@/lib/repositories/liberacoes'

export async function GET() {
  try {
    const liberacoes = await getAllDashboardLiberacoes()
    const out: Record<string, { is_publico: boolean; cliente_ids: string[] }> = {}
    for (const [key, val] of Object.entries(liberacoes)) {
      out[key] = { is_publico: val.isPublico, cliente_ids: val.clienteIds }
    }
    return NextResponse.json({ liberacoes: out })
  } catch (err) {
    console.error('[dashboards/liberacoes GET]', err)
    return NextResponse.json({ liberacoes: {} })
  }
}
