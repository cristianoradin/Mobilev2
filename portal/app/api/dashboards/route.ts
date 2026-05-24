import { NextRequest, NextResponse } from 'next/server'
import { listDashboardsDB, createDashboardDB } from '@/lib/repositories/liberacoes'

export async function GET() {
  try {
    const dashboards = await listDashboardsDB()
    return NextResponse.json({ dashboards })
  } catch (err) {
    console.error('[dashboards GET]', err)
    return NextResponse.json({ dashboards: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const d = await createDashboardDB({
      nome:      body.nome.trim(),
      descricao: body.descricao ?? null,
      cor:       body.cor ?? '#009c3b',
      widgets:   body.widgets ?? [],
    })
    return NextResponse.json({ dashboard: d }, { status: 201 })
  } catch (err) {
    console.error('[dashboards POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
