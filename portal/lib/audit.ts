/**
 * Helpers de auditoria — insere eventos na tabela audit_log de forma não-bloqueante.
 *
 * Usage (fire-and-forget — não aguardar):
 *   void writeAudit(req, { acao: 'cliente.create', recurso: nome, status: 'ok' })
 *
 * Usage (aguardar — quando você quer garantir o registro antes de responder):
 *   await writeAudit(req, { acao: 'auth.login_failed', status: 'warn' })
 */
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'
import { getDb, isDbAvailable } from '@/lib/db'

export interface AuditEntry {
  acao:       string                      // ex: 'cliente.create', 'auth.login_failed'
  recurso?:   string                      // ex: nome do cliente, id do template
  status?:    'ok' | 'warn' | 'error'     // default 'ok'
  cliente_id?: string                     // UUID do cliente relacionado (opcional)
  payload?:   Record<string, unknown>     // dados extras em JSONB
  // Passa admin explicitamente quando não há cookie ainda (ex: auth.login)
  admin?:     { email: string; nome: string; id?: string }
}

/**
 * Extrai o IP real do request, considerando proxies.
 */
function getIP(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? null
}

/**
 * Retorna o admin atual da sessão, silenciosamente.
 * Funciona tanto em Server Actions quanto em Route Handlers.
 */
async function getCurrentAdmin(): Promise<{ id?: string; email: string; nome: string } | null> {
  try {
    // cookies() funciona em Server Components/Actions; em Route Handlers usamos o cookie do req
    const jar   = await cookies()
    const token = jar.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await verifySessionToken(token)
    if (!session) return null
    return { id: session.id, email: session.email, nome: session.nome }
  } catch {
    return null
  }
}

/**
 * Insere um evento de auditoria.
 * Não lança exceção — falhas são apenas logadas no console.
 */
export async function writeAudit(req: NextRequest, entry: AuditEntry): Promise<void> {
  if (!isDbAvailable()) return

  try {
    const db    = getDb()
    const admin = entry.admin ?? await getCurrentAdmin()
    const ip    = getIP(req)

    const payload = {
      ...(entry.payload ?? {}),
      ...(admin ? { admin_email: admin.email, admin_nome: admin.nome, admin_id: admin.id } : {}),
    }

    await db`
      INSERT INTO audit_log
        (cliente_id, acao, recurso, payload, ip_address, status)
      VALUES (
        ${entry.cliente_id ?? null},
        ${entry.acao},
        ${entry.recurso ?? null},
        ${db.json(payload)},
        ${ip ?? null},
        ${entry.status ?? 'ok'}
      )
    `
  } catch (err) {
    // Nunca deixa a auditoria derrubar o request principal
    console.warn('[audit] falha ao registrar evento:', err)
  }
}
