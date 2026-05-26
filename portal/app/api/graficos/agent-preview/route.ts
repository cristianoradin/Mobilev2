/**
 * POST /api/graficos/agent-preview
 *
 * Envia o SQL para o agente do cliente e retorna as colunas + linhas reais.
 *
 * Fluxo:
 *  1. Busca cliente (CNPJ + empresa IDs) no banco
 *  2. Registra um template temporário no cache do agente via SYNC_TEMPLATE
 *  3. Gera user JWT de preview (role=dono, empresas do cliente)
 *  4. Publica READ_QUERY no tópico do agente com response_topic único
 *  5. Aguarda resposta MQTT por até 30s
 *  6. Retorna { columns, rows, count } ao frontend
 *
 * Body: { sql: string, cliente_id: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID }                from 'crypto'
import { getDb }                     from '@/lib/db'
import { generateUserJWT }           from '@/lib/jwt'
import { mqttRequestResponse, publishMqtt } from '@/lib/mqttpublish'

const WRITE_KEYWORDS = /^\s*(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|do|call)\b/i
const PREVIEW_TIMEOUT_MS = 30_000

export async function POST(req: NextRequest) {
  try {
    const { sql: rawSql, cliente_id, date_from, date_to } = await req.json() as {
      sql?:        string
      cliente_id?: string
      date_from?:  string  // YYYY-MM-DD (opcional)
      date_to?:    string  // YYYY-MM-DD (opcional)
    }

    if (!rawSql?.trim())   return NextResponse.json({ error: 'SQL é obrigatório' },        { status: 400 })
    if (!cliente_id?.trim()) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })

    if (WRITE_KEYWORDS.test(rawSql.trim())) {
      return NextResponse.json(
        { error: 'Apenas queries SELECT são permitidas no preview' },
        { status: 400 },
      )
    }

    // ── 1. Busca cliente: CNPJ e empresa IDs ───────────────────────────────────
    const db = getDb()

    const clienteRows = await db`
      SELECT c.cnpj, c.nome
      FROM   clientes c
      WHERE  c.id = ${cliente_id}::uuid AND c.ativo = true
      LIMIT  1
    `
    if (!clienteRows.length) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const cnpj     = String(clienteRows[0].cnpj)
    const cnpjClean = cnpj.replace(/[.\-/]/g, '')

    const empresaRows = await db`
      SELECT id, codigo_erp FROM empresas
      WHERE  cliente_id = ${cliente_id}::uuid AND ativo = true
    `
    // Usa codigo_erp (ID local do ERP) quando disponível, senão o ID do portal
    const empresaIds = empresaRows.map(r =>
      Number((r as { id: number; codigoErp?: number }).codigoErp ?? r.id)
    ) as number[]

    if (!empresaIds.length) {
      return NextResponse.json({ error: 'Cliente sem empresas cadastradas' }, { status: 422 })
    }

    // ── 2. Registra template temporário no agente via SYNC_TEMPLATE ────────────
    const previewId  = `preview-${randomUUID()}`
    const syncTopic  = `sga/${cnpjClean}/config`

    const templatePayload = {
      id:          previewId,
      nome:        'Preview Portal',
      chart_type:  'area',
      query: {
        sql:              rawSql,
        refresh_seconds:  0,
        timeout_seconds:  25,
      },
      axes:        { x: { field: 'x', label: 'X' }, y: [{ field: 'y', label: 'Y' }] },
      display:     { height: 'md', show_legend: false, show_tooltip: false },
      permissions: { min_role: 'operador' },
    }

    await publishMqtt(syncTopic, {
      type:        'SYNC_TEMPLATE',
      request_id:  `sync-${previewId}`,
      template_id: previewId,
      payload:     templatePayload,
      timestamp:   Date.now(),
    })

    // Aguarda o agente processar o SYNC (pequena folga)
    await new Promise(r => setTimeout(r, 400))

    // ── 3. Gera JWT de preview (agente aceita qualquer JWT bem-formado) ─────────
    const userJwt = await generateUserJWT(
      'portal-preview',
      'dono',
      cliente_id,
      cnpj,
      empresaIds,
    )

    // ── 4. Envia READ_QUERY e aguarda resposta ─────────────────────────────────
    const requestId    = randomUUID()
    const responseTopic = `sga/portal/preview/${requestId}`
    const queryTopic   = `sga/${cnpjClean}/query`

    const response = await mqttRequestResponse(
      queryTopic,
      {
        type:           'READ_QUERY',
        request_id:     requestId,
        template_id:    previewId,
        user_jwt:       userJwt,
        empresas_ids:   empresaIds,
        force_refresh:  true,
        response_topic: responseTopic,
        timestamp:      Date.now(),
        // Repassa filtro de período para o agente substituir no SQL
        ...(date_from ? { date_from } : {}),
        ...(date_to   ? { date_to   } : {}),
      },
      responseTopic,
      PREVIEW_TIMEOUT_MS,
    )

    // ── 5. Extrai colunas e linhas da resposta ─────────────────────────────────
    if (response.status !== 'success') {
      const msg = String(response.error_message ?? response.status ?? 'Erro desconhecido do agente')
      return NextResponse.json({ error: msg }, { status: 422 })
    }

    const data = (response.data ?? []) as Record<string, unknown>[]

    // Constrói preview do SQL preparado (substitui :empresas_filtradas localmente)
    // Útil pra debug quando query retorna 0 linhas — user vê o que rodou de fato.
    const empresaList = empresaIds.join(', ')
    const preparedSql = rawSql
      .replace(/:empresas_filtradas/g, empresaList)
      .replace(/:date_from/g,   date_from ? `'${date_from}'` : 'NULL')
      .replace(/:date_to/g,     date_to   ? `'${date_to}'`   : 'NULL')

    if (!data.length) {
      return NextResponse.json({
        columns:      [],
        rows:         [],
        count:        0,
        empty:        true,
        empresas_ids: empresaIds,
        prepared_sql: preparedSql,
        hint:         'Query executou sem erro mas retornou 0 linhas. Verifique se os códigos ERP das empresas batem, filtros de período e condições WHERE.',
      })
    }

    const columns = Object.keys(data[0])
    return NextResponse.json({
      columns,
      rows:         data,
      count:        data.length,
      empresas_ids: empresaIds,
      prepared_sql: preparedSql,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent-preview]', msg)

    // Mensagem amigável para timeout
    if (msg.includes('timeout')) {
      return NextResponse.json(
        { error: 'Agente não respondeu — verifique se o agente está online e conectado' },
        { status: 504 },
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
