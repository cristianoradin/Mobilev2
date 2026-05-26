import { getDb } from '@/lib/db'
import { SYSTEM_TEMPLATES } from '@/lib/templates'
import type { ChartMetadata } from '@/lib/types'

/**
 * Garante que campos JSONB sempre retornem como objeto/array, mesmo quando
 * gravados como string (bug de double-serialization de versões anteriores).
 */
function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T } catch { return fallback }
  }
  return raw as T
}

function rowToMeta(r: Record<string, unknown>): ChartMetadata {
  return {
    id:            String(r.id),
    nome:          String(r.nome),
    descricao:     r.descricao    ? String(r.descricao)    : undefined,
    categoria:     String(r.categoria),
    chart_type:    r.chartType    as ChartMetadata['chart_type'],
    query: {
      sql:              String(r.querySql ?? ''),
      refresh_seconds:  Number(r.refreshSeconds ?? 300),
      timeout_seconds:  Number(r.timeoutSeconds ?? 30),
    },
    axes:          parseJson(r.axes,        {} as ChartMetadata['axes']),
    display:       parseJson(r.display,     {} as ChartMetadata['display']),
    permissions:   parseJson(r.permissions, { min_role: 'operador' } as ChartMetadata['permissions']),
    is_publico:    Boolean(r.isPublico),
    cliente_ids:   (r.clienteIds  as string[]) ?? [],
    created_at:    r.createdAt    ? String(r.createdAt)    : undefined,
    kpi_config:    r.kpiConfig    ? parseJson<ChartMetadata['kpi_config']>(r.kpiConfig,    undefined) : undefined,
    report_config: r.reportConfig ? parseJson<ChartMetadata['report_config']>(r.reportConfig, undefined) : undefined,
    button_config: r.buttonConfig ? parseJson<ChartMetadata['button_config']>(r.buttonConfig, undefined) : undefined,
    date_filter:   r.dateFilter   ? parseJson<ChartMetadata['date_filter']>(r.dateFilter,   undefined) : undefined,
    tank_config:   r.tankConfig   ? parseJson<ChartMetadata['tank_config']>(r.tankConfig,   undefined) : undefined,
  }
}

export async function listGraficos(): Promise<ChartMetadata[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, categoria, chart_type, query_sql,
           refresh_seconds, timeout_seconds, axes, display, permissions, is_publico,
           cliente_ids, kpi_config, report_config, button_config, date_filter, tank_config, created_at
    FROM graficos
    ORDER BY created_at DESC
  `
  return rows.map(r => rowToMeta(r as Record<string, unknown>))
}

/**
 * Retorna todos os templates que um cliente pode acessar:
 * públicos + os liberados especificamente para ele.
 * Usado pelo syncAllTemplatesToAgent para re-sincronizar ao heartbeat.
 */
export async function getGraficosByCliente(clienteId: string): Promise<ChartMetadata[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, categoria, chart_type, query_sql,
           refresh_seconds, timeout_seconds, axes, display, permissions, is_publico,
           cliente_ids, kpi_config, report_config, button_config, date_filter, tank_config, created_at
    FROM graficos
    WHERE is_publico = true
       OR ${clienteId}::uuid = ANY(cliente_ids)
    ORDER BY created_at DESC
  `
  return rows.map(r => rowToMeta(r as Record<string, unknown>))
}

export async function getGraficoById(id: string): Promise<ChartMetadata | null> {
  // Verifica templates do sistema primeiro
  const sys = SYSTEM_TEMPLATES.find(t => t.id === id)
  if (sys) return sys

  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, categoria, chart_type, query_sql,
           refresh_seconds, timeout_seconds, axes, display, permissions, is_publico,
           cliente_ids, kpi_config, report_config, button_config, date_filter, tank_config, created_at
    FROM graficos WHERE id = ${id} LIMIT 1
  `
  return rows[0] ? rowToMeta(rows[0] as Record<string, unknown>) : null
}

export async function createGrafico(meta: ChartMetadata): Promise<ChartMetadata> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO graficos (
      nome, descricao, categoria, chart_type, query_sql,
      refresh_seconds, timeout_seconds, axes, display, permissions, is_publico,
      cliente_ids, kpi_config, report_config, button_config, date_filter, tank_config
    )
    VALUES (
      ${meta.nome}, ${meta.descricao ?? null}, ${meta.categoria}, ${meta.chart_type},
      ${meta.query.sql}, ${meta.query.refresh_seconds}, ${meta.query.timeout_seconds},
      ${JSON.stringify(meta.axes)},
      ${JSON.stringify(meta.display)},
      ${JSON.stringify(meta.permissions)},
      ${meta.is_publico},
      ${(meta.cliente_ids ?? [])},
      ${meta.kpi_config    ? JSON.stringify(meta.kpi_config)    : null},
      ${meta.report_config ? JSON.stringify(meta.report_config) : null},
      ${meta.button_config ? JSON.stringify(meta.button_config) : null},
      ${meta.date_filter   ? JSON.stringify(meta.date_filter)   : null},
      ${meta.tank_config   ? JSON.stringify(meta.tank_config)   : null}
    )
    RETURNING *
  `
  return rowToMeta(rows[0] as Record<string, unknown>)
}

export async function setGraficoLiberacao(id: string, isPublico: boolean, clienteIds: string[]): Promise<void> {
  const sql = getDb()
  await sql`UPDATE graficos SET is_publico = ${isPublico}, cliente_ids = ${clienteIds} WHERE id = ${id}`
}

export async function getGraficosForCliente(clienteId: string): Promise<ChartMetadata[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, categoria, chart_type, query_sql,
           refresh_seconds, timeout_seconds, axes, display, permissions, is_publico,
           cliente_ids, kpi_config, report_config, button_config, date_filter, tank_config, created_at
    FROM graficos
    WHERE is_publico = true
       OR ${clienteId}::uuid = ANY(cliente_ids)
    ORDER BY created_at DESC
  `
  return rows.map(r => rowToMeta(r as Record<string, unknown>))
}

export async function deleteGrafico(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM graficos WHERE id = ${id}`
}

export async function deleteGraficoSafe(id: string): Promise<void> {
  try { await deleteGrafico(id) } catch (err) { throw err }
}

export async function updateGrafico(id: string, meta: ChartMetadata): Promise<ChartMetadata> {
  const sql = getDb()
  const rows = await sql`
    UPDATE graficos SET
      nome            = ${meta.nome},
      descricao       = ${meta.descricao ?? null},
      categoria       = ${meta.categoria},
      chart_type      = ${meta.chart_type},
      query_sql       = ${meta.query.sql},
      refresh_seconds = ${meta.query.refresh_seconds},
      timeout_seconds = ${meta.query.timeout_seconds},
      axes            = ${JSON.stringify(meta.axes)},
      display         = ${JSON.stringify(meta.display)},
      permissions     = ${JSON.stringify(meta.permissions)},
      is_publico      = ${meta.is_publico},
      cliente_ids     = ${(meta.cliente_ids ?? [])},
      kpi_config      = ${meta.kpi_config    ? JSON.stringify(meta.kpi_config)    : null},
      report_config   = ${meta.report_config ? JSON.stringify(meta.report_config) : null},
      button_config   = ${meta.button_config ? JSON.stringify(meta.button_config) : null},
      date_filter     = ${meta.date_filter   ? JSON.stringify(meta.date_filter)   : null},
      tank_config     = ${meta.tank_config   ? JSON.stringify(meta.tank_config)   : null},
      updated_at      = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (!rows[0]) throw new Error('Template não encontrado')
  return rowToMeta(rows[0] as Record<string, unknown>)
}

// ── Safe wrappers com fallback ────────────────────────────────────────────────
const memStore: ChartMetadata[] = []

export async function listGraficosSafe(): Promise<ChartMetadata[]> {
  try { return await listGraficos() } catch { return memStore }
}

export async function getGraficoByIdSafe(id: string): Promise<ChartMetadata | null> {
  try { return await getGraficoById(id) } catch { return SYSTEM_TEMPLATES.find(t => t.id === id) ?? null }
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

export async function updateGraficoSafe(id: string, meta: ChartMetadata): Promise<ChartMetadata> {
  try { return await updateGrafico(id, meta) } catch (err) { throw err }
}
