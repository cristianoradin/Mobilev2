import { NextRequest, NextResponse } from 'next/server'
import type { ChartMetadata } from '@/lib/types'
import { listGraficosSafe, createGraficoSafe } from '@/lib/repositories/graficos'
import { writeAudit } from '@/lib/audit'

export async function GET() {
  const graficos = await listGraficosSafe()
  return NextResponse.json({ graficos, total: graficos.length })
}

// Tipos que não usam SQL (não precisam de :empresas_filtradas)
const NO_SQL_TYPES = new Set(['button', 'tank'])

export async function POST(req: NextRequest) {
  try {
    const body: ChartMetadata = await req.json()

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Apenas tipos com SQL precisam do placeholder de segurança
    const needsSQLFilter = !NO_SQL_TYPES.has(body.chart_type)
    if (needsSQLFilter && !body.query?.sql?.includes(':empresas_filtradas')) {
      return NextResponse.json(
        { error: 'SQL deve conter :empresas_filtradas para isolamento multiempresa' },
        { status: 400 },
      )
    }

    const novo = await createGraficoSafe(body)
    void writeAudit(req, { acao: 'grafico.create', recurso: body.nome, status: 'ok' })
    return NextResponse.json({ grafico: novo }, { status: 201 })
  } catch (err) {
    console.error('[graficos] Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
