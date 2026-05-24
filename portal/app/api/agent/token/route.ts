/**
 * POST /api/agent/token
 * Gera o setup token de instalação para um cliente.
 *
 * Body: { cliente_id: string }
 *
 * O token NÃO inclui credenciais de banco — o técnico as digita
 * interativamente no instalador (sga-agent.exe setup <TOKEN>).
 *
 * Retorna:
 *   setup_token  — string "sga1_<base64url>" para usar com: sga-agent.exe setup <TOKEN>
 *   command      — PowerShell one-liner completo pronto para colar
 *   jwt          — JWT do agente (para referência)
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateAgentJWT } from '@/lib/jwt'
import { findClienteSafe } from '@/lib/repositories/clientes'

const BROKER      = process.env.MQTT_BROKER      ?? 'mqtts://cloud.gruposgapetro.com.br:8883'
const PORTAL_URL  = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://cloud.gruposgapetro.com.br:3001'
const PUSH_SECRET = process.env.PUSH_SECRET      ?? ''
const AGENT_EXE_URL = `${PORTAL_URL}/agent/sga-agent.exe`

interface SetupTokenPayload {
  jwt:          string
  cliente_nome: string
  broker:       string
  mqtt_user:    string
  mqtt_pass:    string
  portal_url:   string
  push_secret:  string
  db: {
    host: string
    port: number
    name: string
    user: string
  }
}

function encodeSetupToken(payload: SetupTokenPayload): string {
  const json = JSON.stringify(payload)
  const b64  = Buffer.from(json).toString('base64url')
  return `sga1_${b64}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { cliente_id: string }

    if (!body.cliente_id) {
      return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })
    }

    const cliente = await findClienteSafe(body.cliente_id)
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }
    if (!cliente.ativo) {
      return NextResponse.json({ error: 'Cliente inativo' }, { status: 403 })
    }

    // Gera o JWT do agente
    const jwt = await generateAgentJWT(cliente)

    // Monta o setup token — sem credenciais de banco (técnico digita no local)
    const payload: SetupTokenPayload = {
      jwt,
      cliente_nome: cliente.nome,
      broker:       BROKER,
      mqtt_user:    'agent',
      mqtt_pass:    '',
      portal_url:   PORTAL_URL,
      push_secret:  PUSH_SECRET,
      db: {
        host: 'localhost',
        port: 5432,
        name: '',   // técnico informa durante a instalação
        user: '',   // técnico informa durante a instalação
      },
    }

    const setupToken = encodeSetupToken(payload)

    // PowerShell one-liner para o técnico colar (como Administrador)
    const command = [
      `# Executar no PowerShell como Administrador:`,
      `$url  = "${AGENT_EXE_URL}"`,
      `$dest = "$env:TEMP\\sga-agent.exe"`,
      `Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing`,
      `& $dest setup "${setupToken}"`,
    ].join('\n')

    return NextResponse.json({
      setup_token:  setupToken,
      command,
      jwt,
      cliente_id:   cliente.id,
      cliente_nome: cliente.nome,
      expires_in:   '365d',
    })
  } catch (err) {
    console.error('[agent/token] Erro:', err)
    return NextResponse.json({ error: 'Erro interno ao gerar token' }, { status: 500 })
  }
}
