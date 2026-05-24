/**
 * Repositório de liberações — controla quais templates/dashboards
 * cada cliente pode acessar no app mobile.
 */
import { getDb } from '@/lib/db'

// ── Templates ────────────────────────────────────────────────────────────────

export interface TemplateLiberacao {
  templateKey: string
  isPublico:   boolean
  clienteIds:  string[]
}

export async function getAllTemplateLiberacoes(): Promise<Record<string, TemplateLiberacao>> {
  const sql = getDb()
  const rows = await sql`
    SELECT template_key, is_publico, cliente_ids FROM template_liberacoes
  `
  const result: Record<string, TemplateLiberacao> = {}
  for (const r of rows) {
    result[String(r.templateKey)] = {
      templateKey: String(r.templateKey),
      isPublico:   Boolean(r.isPublico),
      clienteIds:  (r.clienteIds as string[]) ?? [],
    }
  }
  return result
}

export async function setTemplateLiberacao(
  templateKey: string,
  isPublico:   boolean,
  clienteIds:  string[],
): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO template_liberacoes (template_key, is_publico, cliente_ids)
    VALUES (${templateKey}, ${isPublico}, ${clienteIds})
    ON CONFLICT (template_key) DO UPDATE
      SET is_publico  = EXCLUDED.is_publico,
          cliente_ids = EXCLUDED.cliente_ids
  `
}

/** Retorna os template_keys disponíveis para um cliente (público OU liberado pra ele). */
export async function getTemplateKeysForCliente(clienteId: string): Promise<string[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT template_key
    FROM template_liberacoes
    WHERE is_publico = true
       OR ${clienteId}::uuid = ANY(cliente_ids)
  `
  return rows.map(r => String(r.templateKey))
}

// ── Dashboard liberacoes (sistema — dash-001, dash-002, …) ───────────────────

export interface DashboardLiberacao {
  dashboardKey: string
  isPublico:    boolean
  clienteIds:   string[]
}

export async function getAllDashboardLiberacoes(): Promise<Record<string, DashboardLiberacao>> {
  const sql = getDb()
  const rows = await sql`
    SELECT dashboard_key, is_publico, cliente_ids FROM dashboard_liberacoes
  `
  const result: Record<string, DashboardLiberacao> = {}
  for (const r of rows) {
    result[String(r.dashboardKey)] = {
      dashboardKey: String(r.dashboardKey),
      isPublico:    Boolean(r.isPublico),
      clienteIds:   (r.clienteIds as string[]) ?? [],
    }
  }
  return result
}

export async function setDashboardLiberacaoByKey(
  key:        string,
  isPublico:  boolean,
  clienteIds: string[],
): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO dashboard_liberacoes (dashboard_key, is_publico, cliente_ids)
    VALUES (${key}, ${isPublico}, ${clienteIds})
    ON CONFLICT (dashboard_key) DO UPDATE
      SET is_publico  = EXCLUDED.is_publico,
          cliente_ids = EXCLUDED.cliente_ids
  `
}

/** Retorna os dashboard_keys disponíveis para um cliente. */
export async function getDashboardKeysForCliente(clienteId: string): Promise<string[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT dashboard_key
    FROM dashboard_liberacoes
    WHERE is_publico = true
       OR ${clienteId}::uuid = ANY(cliente_ids)
  `
  return rows.map(r => String(r.dashboardKey))
}

// ── Dashboards (user-created, stored in DB) ───────────────────────────────────

export interface DashboardDB {
  id:         string
  nome:       string
  descricao:  string | null
  cor:        string
  widgets:    Array<{ id: string; template_id: string; size: string; order: number }>
  isPublico:  boolean
  clienteIds: string[]
  createdAt:  string
}

export async function listDashboardsDB(): Promise<DashboardDB[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, cor, widgets, is_publico, cliente_ids, created_at
    FROM dashboards
    ORDER BY created_at DESC
  `
  return rows as unknown as DashboardDB[]
}

export async function createDashboardDB(
  d: Pick<DashboardDB, 'nome' | 'descricao' | 'cor' | 'widgets'>,
): Promise<DashboardDB> {
  const sql = getDb()
  const [row] = await sql`
    INSERT INTO dashboards (nome, descricao, cor, widgets)
    VALUES (${d.nome}, ${d.descricao ?? null}, ${d.cor}, ${JSON.stringify(d.widgets)})
    RETURNING id, nome, descricao, cor, widgets, is_publico, cliente_ids, created_at
  `
  return row as unknown as DashboardDB
}

export async function setDashboardLiberacao(
  dashId:    string,
  isPublico: boolean,
  clienteIds: string[],
): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE dashboards
    SET is_publico = ${isPublico}, cliente_ids = ${clienteIds}
    WHERE id = ${dashId}
  `
}

export async function deleteDashboardDB(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM dashboards WHERE id = ${id}`
}

/** Retorna dashboards disponíveis para um cliente (público OU liberado pra ele). */
export async function getDashboardsForCliente(clienteId: string): Promise<DashboardDB[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, nome, descricao, cor, widgets, is_publico, cliente_ids, created_at
    FROM dashboards
    WHERE is_publico = true
       OR ${clienteId}::uuid = ANY(cliente_ids)
    ORDER BY created_at DESC
  `
  return rows as unknown as DashboardDB[]
}
