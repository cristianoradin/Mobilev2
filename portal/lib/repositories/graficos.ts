import { getDb } from '@/lib/db'
import type { ChartMetadata } from '@/lib/types'

function rowToMeta(r: Record<string, unknown>): ChartMetadata {
  return {
    id:          String(r.id),
    nome:        String(r.nome),
    descricao:   r.descricao ? String(r.descricao) : undefined,
    categoria:   String(r.categoria),
    chart_type:  r.chartType as ChartMetadata['chart_type'],
    query: {
      sql:              String(r.querySql),
      refresh_seconds:  Number(r.refreshSeconds),
      timeout_seconds:  Number(r.timeoutSeconds),
    },
    axes:        r.axes as ChartMetadata['axes'],
    display:     r.display as ChartMetadata['display'],
    permissions: r.permissions as ChartMetadata['permissions'],
    is_publico:  Boolean(r.isPublico),
    created_at:  r.createdAt ? String(r.createdAt) : undefined,
  }
}

export async function listGraficos(): Promise<ChartMetadata[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, categoria, chart_type, query_sql,
           refresh_seconds, timeout_seconds, axes, display, permissions, is_publico, created_at
    FROM graficos
    ORDER BY created_at DESC
  `
  return rows.map(r => rowToMeta(r as Record<string, unknown>))
}

export async function createGrafico(meta: ChartMetadata): Promise<ChartMetadata> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO graficos (nome, descricao, categoria, chart_type, query_sql, refresh_seconds,
                          timeout_seconds, axes, display, permissions, is_publico)
    VALUES (
      ${meta.nome}, ${meta.descricao ?? null}, ${meta.categoria}, ${meta.chart_type},
      ${meta.query.sql}, ${meta.query.refresh_seconds}, ${meta.query.timeout_seconds},
      ${JSON.stringify(meta.axes)}, ${JSON.stringify(meta.display)},
      ${JSON.stringify(meta.permissions)}, ${meta.is_publico}
    )
    RETURNING *
  `
  return rowToMeta(rows[0] as Record<string, unknown>)
}

// Fallback para desenvolvimento sem banco (armazena em memória)
const memStore: ChartMetadata[] = []

export async function listGraficosSafe(): Promise<ChartMetadata[]> {
  try {
    return await listGraficos()
  } catch {
    return memStore
  }
}

export async function createGraficoSafe(meta: ChartMetadata): Promise<ChartMetadata> {
  try {
    return await createGrafico(meta)
  } catch {
    const novo = { ...meta, id: `tmpl-${Date.now()}`, created_at: new Date().toISOString() }
    memStore.push(novo)
    return novo
  }
}
