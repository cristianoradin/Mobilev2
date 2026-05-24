/**
 * mqttpublish.ts — publica uma mensagem MQTT via conexão direta ao broker.
 *
 * Usado exclusivamente no servidor (Next.js API routes) para enviar comandos
 * aos agentes sem precisar de uma conexão persistente.
 *
 * Fluxo: conecta → publica → desconecta (fire-and-forget seguro).
 *
 * Em produção, o portal e o EMQX estão na mesma rede Docker, então
 * MQTT_BROKER_INTERNAL = "mqtt://emqx:1883" (sem autenticação — anonymous=true).
 */
import mqtt from 'mqtt'

const BROKER = process.env.MQTT_BROKER_INTERNAL ?? 'mqtt://emqx:1883'

/**
 * Publica `payload` no `topic` com QoS 1.
 * Conecta, publica e desconecta — sem manter conexão persistente.
 */
export function publishMqtt(topic: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, {
      clientId:      `portal-pub-${Date.now()}`,
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
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        cleanup(err ?? undefined)
      })
    })

    client.once('error', (err) => cleanup(err))

    // Timeout de segurança
    setTimeout(() => cleanup(new Error('MQTT publish timeout')), 10_000)
  })
}

/**
 * Publica o mesmo payload para múltiplos tópicos em paralelo.
 * Falhas individuais são ignoradas (best-effort broadcast).
 */
export async function publishMqttBroadcast(
  topics: string[],
  payload: object
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(
    topics.map(t => publishMqtt(t, payload))
  )
  const ok     = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return { ok, failed }
}
