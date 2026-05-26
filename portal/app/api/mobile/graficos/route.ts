/**
 * GET /api/mobile/graficos
 * Retorna templates de gráfico disponíveis para o cliente do JWT.
 * Combina:
 *   - SYSTEM_TEMPLATES liberados via template_liberacoes
 *   - Graficos customizados do DB com is_publico=true ou cliente_id liberado
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest }        from '@/lib/jwt-verify'
import { getTemplateKeysForCliente } from '@/lib/repositories/liberacoes'
import { getGraficosForCliente }     from '@/lib/repositories/graficos'
import { SYSTEM_TEMPLATES }          from '@/lib/templates'

export async function GET(req: NextRequest) {
  const user      = await getUserFromRequest(req)
  const clienteId = user?.client_id ?? null
  if (!clienteId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Busca em paralelo — erros em cada fonte são isolados para não derrubar as demais
  const [keysResult, customResult] = await Promise.allSettled([
    getTemplateKeysForCliente(clienteId),
    getGraficosForCliente(clienteId),
  ])

  if (keysResult.status === 'rejected') {
    console.error('[mobile/graficos] getTemplateKeysForCliente falhou:', keysResult.reason)
  }
  if (customResult.status === 'rejected') {
    console.error('[mobile/graficos] getGraficosForCliente falhou:', customResult.reason)
  }

  const keys         = keysResult.status   === 'fulfilled' ? keysResult.value   : []
  const customGraficos = customResult.status === 'fulfilled' ? customResult.value : []

  // Templates do sistema filtrados pela liberação
  const systemGraficos = SYSTEM_TEMPLATES.filter(t => keys.includes(t.id))

  return NextResponse.json({ graficos: [...systemGraficos, ...customGraficos] })
}
