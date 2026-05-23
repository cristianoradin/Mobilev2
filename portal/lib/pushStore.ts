/**
 * pushStore.ts — armazena subscriptions Web Push em memória (por cnpj).
 *
 * Em produção, substitua por PostgreSQL ou Redis para persistência.
 * Estrutura: Map<cnpj, Set<PushSubscription>>
 */
import type { PushSubscription } from 'web-push'

// Singleton: sobrevive entre requests no mesmo processo Node
const store = new Map<string, PushSubscription[]>()

/** Adiciona ou atualiza subscription para um cnpj */
export function addSubscription(cnpj: string, sub: PushSubscription): void {
  const list = store.get(cnpj) ?? []

  // Remove duplicata pelo endpoint (mesma sub já registrada)
  const deduped = list.filter(s => s.endpoint !== sub.endpoint)
  deduped.push(sub)
  store.set(cnpj, deduped)
}

/** Retorna todas as subscriptions de um cnpj */
export function getSubscriptions(cnpj: string): PushSubscription[] {
  return store.get(cnpj) ?? []
}

/** Remove uma subscription pelo endpoint (após 410/404 do servidor push) */
export function removeSubscription(cnpj: string, endpoint: string): void {
  const list = store.get(cnpj) ?? []
  store.set(cnpj, list.filter(s => s.endpoint !== endpoint))
}
