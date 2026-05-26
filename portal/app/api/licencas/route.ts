/**
 * GET  /api/licencas — lista clientes com dados de licença
 * POST /api/licencas — cria nova licença para um cliente
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'

export interface LicencaItem {
  id:              string | null   // licenca.id (null se cliente sem licença)
  cliente_id:      string
  cliente_nome:    string
  plano:           string
  ativa:           boolean
  data_inicio:     string | null
  data_expiracao:  string | null
  max_usuarios:    number
  max_graficos:    number
  usuarios_ativos: number
}

export async function GET() {
  try {
    const sql = getDb()

    const rows = await sql`
      SELECT
        l.id                                          AS id,
        c.id                                          AS cliente_id,
        c.nome                                        AS cliente_nome,
        COALESCE(l.plano, c.plano)                    AS plano,
        COALESCE(l.ativa, false)                      AS ativa,
        l.data_inicio::text                           AS data_inicio,
        l.data_expiracao::text                        AS data_expiracao,
        COALESCE(l.max_usuarios, 0)                   AS max_usuarios,
        COALESCE(l.max_graficos, 0)                   AS max_graficos,
        COUNT(u.id) FILTER (WHERE u.ativo = true)     AS usuarios_ativos
      FROM clientes c
      LEFT JOIN licencas l ON l.cliente_id = c.id
      LEFT JOIN usuarios u ON u.cliente_id = c.id
      WHERE c.ativo = true
      GROUP BY c.id, c.nome, c.plano, l.id, l.plano, l.ativa,
               l.data_inicio, l.data_expiracao, l.max_usuarios, l.max_graficos
      ORDER BY c.nome
    `

    const licencas: LicencaItem[] = rows.map(r => ({
      id:              r.id ?? null,
      cliente_id:      r.clienteId as string,
      cliente_nome:    r.clienteNome as string,
      plano:           r.plano as string,
      ativa:           r.ativa as boolean,
      data_inicio:     r.dataInicio as string | null,
      data_expiracao:  r.dataExpiracao as string | null,
      max_usuarios:    Number(r.maxUsuarios),
      max_graficos:    Number(r.maxGraficos),
      usuarios_ativos: Number(r.usuariosAtivos),
    }))

    return NextResponse.json({ licencas })
  } catch (err) {
    console.error('[GET /api/licencas]', err)
    return NextResponse.json({ licencas: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      cliente_id:      string
      plano:           string
      max_usuarios:    number
      max_graficos:    number
      data_expiracao?: string | null
    }

    if (!body.cliente_id) {
      return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })
    }

    const sql = getDb()

    const [row] = await sql`
      INSERT INTO licencas (cliente_id, plano, ativa, data_inicio, data_expiracao, max_usuarios, max_graficos)
      VALUES (
        ${body.cliente_id}::uuid,
        ${body.plano},
        true,
        NOW(),
        ${body.data_expiracao ?? null}::timestamptz,
        ${body.max_usuarios},
        ${body.max_graficos}
      )
      RETURNING id
    `
    void writeAudit(req, { acao: 'licenca.create', recurso: body.plano, status: 'ok', cliente_id: body.cliente_id })
    return NextResponse.json({ ok: true, id: row.id })
  } catch (err) {
    console.error('[POST /api/licencas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
