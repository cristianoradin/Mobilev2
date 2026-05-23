import { NextRequest, NextResponse } from 'next/server'
import type { ChartMetadata } from '@/lib/types'
import { listGraficosSafe, createGraficoSafe } from '@/lib/repositories/graficos'

export async function GET() {
  const graficos = await listGraficosSafe()
  return NextResponse.json({ graficos, total: graficos.length })
}

export async function POST(req: NextRequest) {
  try {
    const body: ChartMetadata = await req.json()

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (!body.query?.sql?.includes(':empresas_filtradas')) {
      return NextResponse.json(
        { error: 'SQL deve conter :empresas_filtradas para isolamento multiempresa' },
        { status: 400 },
      )
    }

    const novo = await createGraficoSafe(body)
    return NextResponse.json({ grafico: novo }, { status: 201 })
  } catch (err) {
    console.error('[graficos] Erro:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
