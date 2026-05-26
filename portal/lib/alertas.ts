/**
 * alertas.ts — engine de detecção e reconciliação de alertas.
 *
 * Cada regra retorna lista de "alertas detectados agora". O reconciliador:
 *   1. Cria novos (insert ... where not exists em aberto)
 *   2. Resolve os que estavam abertos mas não foram detectados nesta rodada
 *
 * Quando a Fase 2 (push) entrar, sendPushOnInsert() será chamado para cada
 * alerta novo. Por enquanto só persiste estado.
 */
import { getDb } from '@/lib/db'
import { sendPush } from '@/lib/webpush'
import { getAllAdminSubscriptions, removeAdminSubscription, touchAdminSubscription } from '@/lib/adminPushStore'

export type Severidade = 'info' | 'warn' | 'critical'

export interface AlertaDetectado {
  tipo:       string
  ref_id:     string          // '' para alertas globais
  severidade: Severidade
  titulo:     string
  detalhe:    string
}

// ─── Regras de detecção ──────────────────────────────────────────────────────

async function detectAgentesOffline(): Promise<AlertaDetectado[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      a.id::text,
      c.nome AS cliente_nome,
      EXTRACT(EPOCH FROM (NOW() - a.ultimo_heartbeat))::int AS seg_offline
    FROM agentes a
    JOIN clientes c ON c.id = a.cliente_id
    WHERE a.ultimo_heartbeat IS NOT NULL
      AND a.ultimo_heartbeat < NOW() - INTERVAL '30 minutes'
  `
  return rows.map(r => {
    const min = Math.floor(Number(r.segOffline) / 60)
    const hLabel = min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}min`
    return {
      tipo:       'agente_offline',
      ref_id:     String(r.id),
      severidade: min >= 1440 ? 'critical' : 'warn' as Severidade,
      titulo:     `Agente offline: ${r.clienteNome}`,
      detalhe:    `Sem heartbeat há ${hLabel}`,
    }
  })
}

async function detectLicencasExpirando(): Promise<AlertaDetectado[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      l.id::text,
      l.data_expiracao,
      (l.data_expiracao - CURRENT_DATE)::int AS dias,
      c.nome AS cliente_nome
    FROM licencas l
    JOIN clientes c ON c.id = l.cliente_id
    WHERE l.ativa = true
      AND l.data_expiracao IS NOT NULL
      AND l.data_expiracao <= CURRENT_DATE + INTERVAL '7 days'
  `
  return rows.map(r => {
    const d = Number(r.dias)
    return {
      tipo:       'licenca_expirando',
      ref_id:     String(r.id),
      severidade: (d <= 0 ? 'critical' : 'warn') as Severidade,
      titulo:     `Licença expirando: ${r.clienteNome}`,
      detalhe:    d <= 0
        ? `Expirou em ${new Date(r.dataExpiracao).toLocaleDateString('pt-BR')}`
        : `Expira em ${d} dia(s) (${new Date(r.dataExpiracao).toLocaleDateString('pt-BR')})`,
    }
  })
}

async function detectErrorRate(): Promise<AlertaDetectado[]> {
  const sql = getDb()
  // Janela de 4h — exige volume mínimo (10 eventos) pra não disparar com amostra pequena
  const [row] = await sql`
    SELECT
      COUNT(*)::int                                       AS total,
      COUNT(*) FILTER (WHERE status = 'error')::int       AS errors
    FROM audit_log
    WHERE created_at > NOW() - INTERVAL '4 hours'
  `
  const total  = Number(row?.total  ?? 0)
  const errors = Number(row?.errors ?? 0)
  if (total < 10) return []
  const pct = (errors / total) * 100
  if (pct < 5) return []
  return [{
    tipo:       'error_rate',
    ref_id:     '',
    severidade: pct >= 20 ? 'critical' : 'warn',
    titulo:     `Taxa de erros alta: ${pct.toFixed(1)}%`,
    detalhe:    `${errors} erros em ${total} eventos nas últimas 4h`,
  }]
}

async function detectEmqxDown(): Promise<AlertaDetectado[]> {
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 3000)
    const res  = await fetch('http://emqx:18083/api/v5/status', { signal: ctrl.signal })
    clearTimeout(tid)
    if (res.ok) return []
  } catch { /* unreachable */ }
  return [{
    tipo:       'emqx_down',
    ref_id:     '',
    severidade: 'critical',
    titulo:     'EMQX inacessível',
    detalhe:    'Broker MQTT não respondeu em 3s — agentes podem estar desconectados',
  }]
}

async function detectDbDown(): Promise<AlertaDetectado[]> {
  // Se essa função roda, o DB está vivo (chegou até aqui). Mantida como
  // placeholder pra simetria; um alerta de DB down precisa de health check
  // externo. Por enquanto retorna vazio.
  return []
}

// ─── Broadcast (Web Push pra admins) ─────────────────────────────────────────

interface PushOptions {
  title:        string
  body:         string
  tag:          string
  severidade:   Severidade
  alertaId?:    number   // se definido, atualiza ultimo_envio/envios após sucesso
}

/**
 * Envia push pra todos os admins inscritos. Faz cleanup de subs 410/404.
 * Se `alertaId` for passado, incrementa envios/ultimo_envio do alerta após sucesso.
 * Nunca lança — falhas são logadas e retornam contagem 0.
 */
async function broadcastPush(opts: PushOptions): Promise<number> {
  try {
    const subs = await getAllAdminSubscriptions()
    if (subs.length === 0) return 0

    const payload = {
      title:      opts.title,
      body:       opts.body,
      tag:        opts.tag,
      severidade: opts.severidade,
      data:       { url: '/observabilidade', alertaId: opts.alertaId ?? null },
    }

    let enviados = 0
    for (const s of subs) {
      const result = await sendPush(s.sub, payload)
      if (result === 'ok') {
        enviados++
        await touchAdminSubscription(s.id).catch(() => {})
      } else if (result === 'expired') {
        await removeAdminSubscription(s.endpoint).catch(() => {})
      }
    }

    if (enviados > 0 && opts.alertaId) {
      const sql = getDb()
      await sql`
        UPDATE alertas
           SET ultimo_envio = NOW(),
               envios       = envios + ${enviados}
         WHERE id = ${opts.alertaId}
      `.catch(() => {})
    }

    return enviados
  } catch (err) {
    console.error('[alertas] broadcast falhou:', err)
    return 0
  }
}

/** Push pra alerta novo ou re-armado (mesma severidade/título, atualiza estado). */
function broadcastAlerta(alertaId: number, d: AlertaDetectado): Promise<number> {
  return broadcastPush({
    title:      d.titulo,
    body:       d.detalhe,
    tag:        `alerta-${d.tipo}-${d.ref_id || 'global'}`,
    severidade: d.severidade,
    alertaId,
  })
}

/** Push de resolução — tag diferente (não substitui o original na bandeja). */
function broadcastResolvido(d: AlertaDetectado): Promise<number> {
  return broadcastPush({
    title:      `Resolvido: ${d.titulo}`,
    body:       d.detalhe,
    tag:        `resolvido-${d.tipo}-${d.ref_id || 'global'}`,
    severidade: 'info',
    // sem alertaId → não atualiza ultimo_envio (alerta vai ser marcado resolvido em seguida)
  })
}

// ─── Reconciliação ───────────────────────────────────────────────────────────

interface CheckResult {
  detectados:  number
  criados:     number
  resolvidos:  number
  rearmados:   number     // Alertas críticos re-notificados (push lembrete)
  abertos:     number
  novosIds:    number[]   // IDs dos alertas recém-criados
  enviosPush:  number     // Total de pushes entregues nesta rodada (criados + resolvidos + rearmados)
}

export async function checkAlertas(): Promise<CheckResult> {
  const sql = getDb()

  // Roda todas as regras em paralelo
  const results = await Promise.all([
    detectAgentesOffline().catch(e => { console.error('[alertas] detectAgentesOffline:', e); return [] }),
    detectLicencasExpirando().catch(e => { console.error('[alertas] detectLicencasExpirando:', e); return [] }),
    detectErrorRate().catch(e => { console.error('[alertas] detectErrorRate:', e); return [] }),
    detectEmqxDown().catch(e => { console.error('[alertas] detectEmqxDown:', e); return [] }),
    detectDbDown().catch(e => { console.error('[alertas] detectDbDown:', e); return [] }),
  ])
  const detectados = results.flat()
  const chaveDetectados = new Set(detectados.map(d => `${d.tipo}|${d.ref_id}`))

  // Snapshot dos alertas abertos atualmente — com todos os campos para reuso
  const abertos = await sql`
    SELECT id, tipo, ref_id, severidade, titulo, detalhe, ultimo_envio
    FROM alertas WHERE estado = 'aberto'
  `
  let enviosPush = 0

  // 1. Resolve os que não estão mais sendo detectados (envia push de resolução)
  let resolvidos = 0
  for (const a of abertos) {
    const chave = `${a.tipo}|${a.refId ?? ''}`
    if (!chaveDetectados.has(chave)) {
      enviosPush += await broadcastResolvido({
        tipo:       String(a.tipo),
        ref_id:     String(a.refId ?? ''),
        severidade: a.severidade as Severidade,
        titulo:     String(a.titulo),
        detalhe:    String(a.detalhe ?? ''),
      })
      await sql`
        UPDATE alertas
           SET estado = 'resolvido', resolvido_em = NOW()
         WHERE id = ${a.id}
      `
      resolvidos++
    }
  }

  // 2. Cria os novos (sem ON CONFLICT por causa do índice parcial — usamos WHERE NOT EXISTS)
  //    Pra cada alerta efetivamente criado, dispara push pros admins.
  const novosIds: number[] = []
  for (const d of detectados) {
    const [inserted] = await sql`
      INSERT INTO alertas (tipo, ref_id, severidade, titulo, detalhe)
      SELECT ${d.tipo}, ${d.ref_id}, ${d.severidade}, ${d.titulo}, ${d.detalhe}
      WHERE NOT EXISTS (
        SELECT 1 FROM alertas
         WHERE tipo = ${d.tipo}
           AND ref_id = ${d.ref_id}
           AND estado = 'aberto'
      )
      RETURNING id
    `
    if (inserted?.id) {
      const id = Number(inserted.id)
      novosIds.push(id)
      enviosPush += await broadcastAlerta(id, d)
    }
  }

  // 3. Re-arme: alertas críticos abertos com ultimo_envio > 4h (ou nunca enviado)
  //    Não recria — apenas re-dispara o push pra lembrar.
  let rearmados = 0
  const ainda = abertos.filter(a => {
    const chave = `${a.tipo}|${a.refId ?? ''}`
    return chaveDetectados.has(chave) && a.severidade === 'critical'
  })
  for (const a of ainda) {
    const ue = a.ultimoEnvio as Date | null
    const stale = !ue || (Date.now() - new Date(ue).getTime()) > 4 * 60 * 60 * 1000
    if (!stale) continue
    enviosPush += await broadcastAlerta(Number(a.id), {
      tipo:       String(a.tipo),
      ref_id:     String(a.refId ?? ''),
      severidade: a.severidade as Severidade,
      titulo:     `Ainda aberto: ${a.titulo}`,
      detalhe:    String(a.detalhe ?? ''),
    })
    rearmados++
  }

  // Contagem final de abertos
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM alertas WHERE estado = 'aberto'`

  return {
    detectados: detectados.length,
    criados:    novosIds.length,
    resolvidos,
    rearmados,
    abertos:    Number(count ?? 0),
    novosIds,
    enviosPush,
  }
}

// ─── Leitura para a UI ────────────────────────────────────────────────────────

export interface AlertaRow {
  id:           number
  tipo:         string
  refId:        string | null
  severidade:   Severidade
  titulo:       string
  detalhe:      string | null
  criadoEm:     string
  envios:       number
}

export async function getAlertasAbertos(): Promise<AlertaRow[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, tipo, ref_id, severidade, titulo, detalhe, criado_em, envios
    FROM alertas
    WHERE estado = 'aberto'
    ORDER BY
      CASE severidade WHEN 'critical' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
      criado_em DESC
    LIMIT 50
  `
  return rows.map(r => ({
    id:         Number(r.id),
    tipo:       String(r.tipo),
    refId:      r.refId === '' ? null : (r.refId as string | null),
    severidade: r.severidade as Severidade,
    titulo:     String(r.titulo),
    detalhe:    r.detalhe as string | null,
    criadoEm:   String(r.criadoEm),
    envios:     Number(r.envios ?? 0),
  }))
}

export interface AlertaHistoricoRow extends AlertaRow {
  estado:        'aberto' | 'resolvido'
  resolvidoEm:   string | null
  duracaoSeg:    number   // segundos entre criado e resolvido (ou agora, se aberto)
}

export async function getAlertasHistorico(diasAtras = 30): Promise<AlertaHistoricoRow[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      id, tipo, ref_id, severidade, titulo, detalhe, estado,
      criado_em, resolvido_em, envios,
      EXTRACT(EPOCH FROM (COALESCE(resolvido_em, NOW()) - criado_em))::int AS duracao_seg
    FROM alertas
    WHERE criado_em > NOW() - (${diasAtras} || ' days')::interval
    ORDER BY criado_em DESC
    LIMIT 500
  `
  return rows.map(r => ({
    id:           Number(r.id),
    tipo:         String(r.tipo),
    refId:        r.refId === '' ? null : (r.refId as string | null),
    severidade:   r.severidade as Severidade,
    titulo:       String(r.titulo),
    detalhe:      r.detalhe as string | null,
    criadoEm:     String(r.criadoEm),
    envios:       Number(r.envios ?? 0),
    estado:       r.estado as 'aberto' | 'resolvido',
    resolvidoEm:  r.resolvidoEm as string | null,
    duracaoSeg:   Number(r.duracaoSeg ?? 0),
  }))
}
