/**
 * GET /api/licencas
 * Retorna clientes com dados de licença e contagem de usuários ativos.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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
