/**
 * mqttpublish.ts — publica uma mensagem MQTT via conexão direta ao broker.
 *
 * Usado exclusivamente no servidor (Next.js API routes) para enviar comandos
 * aos agentes sem precisar de uma conexão persistente.
 *
 * Fluxo: conecta → publica → desconecta (fire-and-forget seguro).
 *
 * Em produção, o portal e o EMQX estão na mesma rede Docker.
 * Autenticação: JWT RS256 gerado localmente com JWT_PRIVATE_KEY (mesmo backend do EMQX).
 * Em dev sem JWT_PRIVATE_KEY: usa MQTT_PORTAL_PASS + EMQX_ALLOW_ANONYMOUS=true como fallback.
 */
import mqtt from 'mqtt'
import { SignJWT, importPKCS8 } from 'jose'

const BROKER      = process.env.MQTT_BROKER_INTERNAL ?? 'mqtt://emqx:1883'
const PORTAL_USER = 'sga_portal'

// JWT de serviço cacheado em memória — válido por 365d
let _cachedJwt: string | null = null

async function getPortalJwt(): Promise<string> {
  if (_cachedJwt) return _cachedJwt

  const privateKeyPem = process.env.JWT_PRIVATE_KEY
  if (!privateKeyPem) {
    // Dev sem chave RSA: fallback para senha estática (funciona com ALLOW_ANONYMOUS=true)
    return process.env.MQTT_PORTAL_PASS ?? ''
  }

  const normalizedKey = privateKeyPem.replace(/\\n/g, '\n')
  const privateKey    = await importPKCS8(normalizedKey, 'RS256')
  _cachedJwt = await new SignJWT({ type: 'service_token', role: 'portal' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('sga_portal')
    .setIssuedAt()
    .setExpirationTime('365d')
    .setIssuer('sgapetro.cloud')
    .sign(privateKey)

  return _cachedJwt
}

/**
 * Publica `payload` no `topic` com QoS 1.
 * Conecta, publica e desconecta — sem manter conexão persistente.
 *
 * @param retain  Se true, o broker armazena a mensagem como retained —
 *                novos subscribers recebem imediatamente ao se inscrever.
 *                Use true para SYNC_TEMPLATE, false (padrão) para comandos pontuais.
 */
export async function publishMqtt(
  topic:   string,
  payload: object,
  opts:    { retain?: boolean } = {},
): Promise<void> {
  const password = await getPortalJwt()
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, {
      clientId:      `portal-pub-${Date.now()}`,
      username:      PORTAL_USER,
      password,
      clean:         true,
      connectTimeout: 8_000,
      reconnectPeriod: 0,  // sem reconnect — conexão one-shot
    })

    const cleanup = (err?: Error) => {
      try { client.end(true) } catch { /* já encerrado */ }
      if (err) reject(err)
      else     resolve()
    }

    client.once('connect', () => {
      client.publish(
        topic,
        JSON.stringify(payload),
        { qos: 1, retain: opts.retain ?? false },
        (err) => cleanup(err ?? undefined),
      )
    })

    client.once('error', (err) => cleanup(err))

    // Timeout de segurança
    setTimeout(() => cleanup(new Error('MQTT publish timeout')), 10_000)
  })
}

/**
 * Envia um comando MQTT e aguarda a resposta em `responseTopic`.
 * Conecta, subscreve, publica e aguarda — timeout configurável.
 * Retorna o payload JSON da resposta ou lança erro.
 */
export async function mqttRequestResponse(
  publishTopic:  string,
  payload:       object,
  responseTopic: string,
  timeoutMs      = 30_000,
): Promise<Record<string, unknown>> {
  const password = await getPortalJwt()
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, {
      clientId:        `portal-rr-${Date.now()}`,
      username:        PORTAL_USER,
      password,
      clean:           true,
      connectTimeout:  8_000,
      reconnectPeriod: 0,
    })

    let settled = false

    const done = (result?: Record<string, unknown>, err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { client.end(true) } catch { /* ignore */ }
      if (err) reject(err)
      else     resolve(result!)
    }

    // Timeout global
    const timer = setTimeout(
      () => done(undefined, new Error('timeout — agente não respondeu em tempo')),
      timeoutMs,
    )

    client.once('error', (err) => done(undefined, err))

    client.once('connect', () => {
      // 1. Subscreve ao tópico de resposta ANTES de publicar
      client.subscribe(responseTopic, { qos: 1 }, (err) => {
        if (err) return done(undefined, err)

        // 2. Publica o comando
        client.publish(publishTopic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) done(undefined, err)
        })
      })
    })

    // 3. Recebe resposta
    client.on('message', (_topic, message) => {
      try {
        done(JSON.parse(message.toString()) as Record<string, unknown>)
      } catch {
        done(undefined, new Error('resposta JSON inválida do agente'))
      }
    })
  })
}

/**
 * Publica o mesmo payload para múltiplos tópicos em paralelo.
 * Falhas individuais são ignoradas (best-effort broadcast).
 */
export async function publishMqttBroadcast(
  topics:  string[],
  payload: object,
  opts:    { retain?: boolean } = {},
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(
    topics.map(t => publishMqtt(t, payload, opts))
  )
  const ok     = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return { ok, failed }
}
