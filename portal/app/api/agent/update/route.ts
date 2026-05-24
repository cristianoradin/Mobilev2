/**
 * POST /api/agent/update
 * Dispara o comando UPDATE_AGENT via MQTT para um cliente específico ou todos.
 *
 * Body: {
 *   cnpj?:    string   — CNPJ do cliente (14 dígitos). Omitir = todos os clientes ativos.
 *   version:  string   — versão nova ex: "1.1.0"
 *   url:      string   — URL pública do binário (ex: https://host/agent/sga-agent-1.1.0-windows-amd64.exe)
 *   sha256:   string   — hash SHA-256 hex do binário
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { publishMqtt, publishMqttBroadcast } from '@/lib/mqttpublish'

const PUSH_SECRET = process.env.PUSH_SECRET ?? ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      cnpj?:    string
      version?: string
      url?:     string
      sha256?:  string
    }

    const { version, url, sha256 } = body
    if (!version?.trim() || !url?.trim() || !sha256?.trim()) {
      return NextResponse.json(
        { error: 'version, url e sha256 são obrigatórios' },
        { status: 400 }
      )
    }

    if (!PUSH_SECRET) {
      return NextResponse.json(
        { error: 'PUSH_SECRET não configurado no servidor' },
        { status: 500 }
      )
    }

    const payload = {
      type:      'UPDATE_AGENT',
      version:   version.trim(),
      url:       url.trim(),
      sha256:    sha256.trim().toLowerCase(),
      secret:    PUSH_SECRET,
      timestamp: Date.now(),
    }

    if (body.cnpj) {
      // Envia para um CNPJ específico
      const clean = body.cnpj.replace(/\D/g, '')
      if (clean.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
      }
      const topic = `sga/${clean}/command`
      await publishMqtt(topic, payload)
      return NextResponse.json({ ok: true, sent: 1, topics: [topic] })
    }

    // Envia para todos os clientes ativos
    const sql = await getDb()
    const rows = await sql`SELECT cnpj FROM clientes WHERE ativo = true`
    const topics = rows.map(r => {
      const clean = String(r.cnpj).replace(/\D/g, '')
      return `sga/${clean}/command`
    })

    if (topics.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'Nenhum cliente ativo' })
    }

    const { ok, failed } = await publishMqttBroadcast(topics, payload)
    return NextResponse.json({ ok: true, sent: ok, failed, total: topics.length })
  } catch (err) {
    console.error('[POST /api/agent/update]', err)
    return NextResponse.json({ error: 'Erro interno ao enviar comando' }, { status: 500 })
  }
}
