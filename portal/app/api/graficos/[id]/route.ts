/**
 * GET  /api/graficos/[id]  — retorna template por ID (sistema ou DB)
 * PUT  /api/graficos/[id]  — atualiza template (sistema → cria novo; DB → atualiza)
 */
import { NextRequest, NextResponse } from 'next/server'
import type { ChartMetadata } from '@/lib/types'
import {
  getGraficoByIdSafe,
  createGraficoSafe,
  updateGraficoSafe,
  deleteGraficoSafe,
} from '@/lib/repositories/graficos'
import { SYSTEM_TEMPLATES } from '@/lib/templates'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const template = await getGraficoByIdSafe(id)
  if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
  const isSystem = SYSTEM_TEMPLATES.some(t => t.id === id)
  return NextResponse.json({ template, isSystem })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Templates do sistema não podem ser deletados
  if (id.startsWith('tmpl-')) {
    return NextResponse.json({ error: 'Templates do sistema não podem ser excluídos' }, { status: 403 })
  }

  try {
    await deleteGraficoSafe(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/graficos/[id]]', err)
    return NextResponse.json({ error: 'Erro ao excluir template' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body: ChartMetadata = await req.json()

    if (!body.nome?.trim())
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    // Template do sistema → salva como novo registro no DB
    if (id.startsWith('tmpl-')) {
      const novo = await createGraficoSafe({ ...body, id: '' })
      return NextResponse.json({ template: novo, created: true }, { status: 201 })
    }

    // Template do DB → atualiza
    const updated = await updateGraficoSafe(id, body)
    return NextResponse.json({ template: updated })
  } catch (err) {
    console.error('[PUT /api/graficos/[id]]', err)
    return NextResponse.json({ error: 'Erro ao salvar template' }, { status: 500 })
  }
}
