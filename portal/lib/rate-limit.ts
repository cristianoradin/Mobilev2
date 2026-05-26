/**
 * rate-limit.ts — limitador de requisições em memória (single-instance).
 * Protege endpoints de auth contra brute force.
 * Sem Redis: funciona com 1 instância do portal (situação atual).
 */

interface Entry { count: number; resetAt: number }

const store    = new Map<string, Entry>()
const MAX_SIZE = 20_000  // evita crescimento ilimitado

function cleanup() {
  const now = Date.now()
  let n = 0
  for (const [k, e] of store) {
    if (e.resetAt < now) { store.delete(k); n++ }
    if (n >= 2_000) break
  }
}

/**
 * Verifica se a chave está dentro do limite.
 * @param key      Identificador (IP, email, etc.)
 * @param max      Tentativas máximas na janela
 * @param windowMs Tamanho da janela em ms
 * @returns { ok: boolean, remaining: number, retryAfterMs: number }
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()

  if (store.size > MAX_SIZE) cleanup()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, retryAfterMs: 0 }
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { ok: true, remaining: max - entry.count, retryAfterMs: 0 }
}
