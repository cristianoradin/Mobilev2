/**
 * emqxApi.ts — cliente para o management API do EMQX 5.
 * Usa Basic Auth com EMQX_API_KEY / EMQX_API_SECRET (bootstrap_file).
 */
const EMQX_URL    = process.env.EMQX_API_URL    ?? 'http://emqx:18083'
const EMQX_KEY    = process.env.EMQX_API_KEY    ?? ''
const EMQX_SECRET = process.env.EMQX_API_SECRET ?? ''

const authHeader = EMQX_KEY && EMQX_SECRET
  ? 'Basic ' + Buffer.from(`${EMQX_KEY}:${EMQX_SECRET}`).toString('base64')
  : ''

async function fetchJson<T>(path: string, timeoutMs = 2500): Promise<T | null> {
  if (!authHeader) return null
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${EMQX_URL}${path}`, {
      headers: { Authorization: authHeader },
      signal:  ctrl.signal,
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  } finally {
    clearTimeout(tid)
  }
}

export interface EmqxStats {
  connections:    number   // conexões atualmente abertas (TCP)
  liveConnections: number  // conexões "vivas" (logadas)
  sessions:       number   // sessões MQTT (inclui persistentes desconectadas)
  subscriptions:  number   // total de assinaturas
  topics:         number   // tópicos distintos com sub ativa
}

export interface EmqxMetrics {
  msgsReceivedRate: number   // msgs/s entrando no broker
  msgsSentRate:     number   // msgs/s saindo do broker
  msgsTotalReceived: number
  msgsTotalSent:    number
}

export async function getEmqxStats(): Promise<EmqxStats | null> {
  // /api/v5/stats retorna um array (1 elemento por nó)
  const arr = await fetchJson<Array<Record<string, number>>>('/api/v5/stats')
  if (!arr || arr.length === 0) return null
  // Soma entre nós (no cluster). Single-node = só o primeiro.
  const sum = (key: string) => arr.reduce((acc, n) => acc + Number(n[key] ?? 0), 0)
  return {
    connections:     sum('connections.count'),
    liveConnections: sum('live_connections.count'),
    sessions:        sum('sessions.count'),
    subscriptions:   sum('subscriptions.count'),
    topics:          sum('topics.count'),
  }
}

export async function getEmqxMetrics(): Promise<EmqxMetrics | null> {
  // /api/v5/metrics também retorna array por nó
  const arr = await fetchJson<Array<{ metrics: Record<string, number> }>>('/api/v5/metrics')
  if (!arr || arr.length === 0) return null
  const sum = (key: string) => arr.reduce((acc, n) => acc + Number(n.metrics?.[key] ?? 0), 0)
  return {
    msgsReceivedRate:  sum('messages.received.rate'),
    msgsSentRate:      sum('messages.sent.rate'),
    msgsTotalReceived: sum('messages.received'),
    msgsTotalSent:     sum('messages.sent'),
  }
}
