/**
 * POST /api/graficos/preview
 * Executa um SQL de template contra o banco do portal e retorna colunas + linhas de amostra.
 *
 * Body: { sql: string }
 *
 * Segurança:
 *  - Apenas queries SELECT são permitidas
 *  - :empresas_filtradas é substituído por um subquery seguro
 *  - :data_inicio / :data_fim → YYYY-MM-DD (últimos 30 dias)
 *  - :datetime_inicio / :datetime_fim → YYYY-MM-DD HH:MM:SS (últimos 30 dias, 00:00:00 / 23:59:59)
 *  - Resultado limitado a 20 linhas
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Palavras-chave que indicam query de escrita — recusadas imediatamente
const WRITE_KEYWORDS = /^\s*(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|do|call)\b/i

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sql?: string; date_from?: string; date_to?: string }
    const rawSql   = body.sql
    const dateFrom = body.date_from  // YYYY-MM-DD (opcional — padrão = 30 dias atrás)
    const dateTo   = body.date_to    // YYYY-MM-DD (opcional — padrão = hoje)

    if (!rawSql?.trim()) {
      return NextResponse.json({ error: 'SQL é obrigatório' }, { status: 400 })
    }

    if (WRITE_KEYWORDS.test(rawSql.trim())) {
      return NextResponse.json(
        { error: 'Apenas queries SELECT são permitidas no preview' },
        { status: 400 },
      )
    }

    const db = getDb()

    // Busca o primeiro empresa_id disponível para substituir :empresas_filtradas
    const empresas = await db`SELECT id FROM empresas ORDER BY created_at LIMIT 1`
    const empresaId = empresas[0]?.id as string | undefined

    // Prepara os parâmetros de substituição
    const now   = new Date()
    const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Substitui os placeholders textuais pelo valor real
    // :empresas_filtradas → array literal do PostgreSQL ou um subquery de fallback
    let processedSql = rawSql

    // Substitui os placeholders conhecidos ANTES do regex genérico
    const empresaLiteral = empresaId ? `'${empresaId}'` : `(SELECT NULL::uuid WHERE false)`

    // Usa datas do body quando fornecidas; caso contrário, últimos 30 dias
    const dateOnlyFrom = dateFrom ?? ago30.toISOString().slice(0, 10)
    const dateOnlyTo   = dateTo   ?? now.toISOString().slice(0, 10)
    const datetimeFrom = `${dateOnlyFrom} 00:00:00`
    const datetimeTo   = `${dateOnlyTo} 23:59:59`

    processedSql = processedSql
      .replace(/:empresas_filtradas/g,  empresaLiteral)
      .replace(/:data_inicio/g,         `'${dateOnlyFrom}'`)
      .replace(/:data_fim/g,            `'${dateOnlyTo}'`)
      .replace(/:datetime_inicio/g,     `'${datetimeFrom}'`)
      .replace(/:datetime_fim/g,        `'${datetimeTo}'`)

    // Remove qualquer placeholder restante — usa lookbehind para não tocar em '::' (cast PG)
    processedSql = processedSql.replace(/(?<!:):[a-zA-Z_][a-zA-Z0-9_]*/g, 'NULL')

    // Remove trailing semicolon se houver
    const cleanSql = processedSql.replace(/;\s*$/, '').trim()

    // Envolve em subquery/CTE para adicionar LIMIT sem alterar a query original.
    // Se o SQL já começa com WITH, usa subquery (PostgreSQL não aceita WITH aninhado como CTE)
    const limitedSql = /^\s*with\b/i.test(cleanSql)
      ? `SELECT * FROM (${cleanSql}) AS _preview LIMIT 20`
      : `WITH _preview AS (${cleanSql}) SELECT * FROM _preview LIMIT 20`

    // db.unsafe executa SQL raw; retorna colunas com os nomes exatos do banco
    const rows = await db.unsafe(limitedSql)

    if (rows.length === 0) {
      return NextResponse.json({ columns: [], rows: [], count: 0 })
    }

    const columns = Object.keys(rows[0])
    const plain   = rows.map(r => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v ?? null])
    ))

    return NextResponse.json({ columns, rows: plain, count: plain.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[graficos/preview] Erro:', msg)
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
