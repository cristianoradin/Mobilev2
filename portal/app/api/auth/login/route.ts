import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE, type AdminSession } from '@/lib/session'
import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/repositories/usuarios'

// ── Menus disponíveis no portal ───────────────────────────────────────────────
export const ALL_MENUS = [
  'dashboard', 'dashboards', 'clientes', 'graficos', 'licencas',
  'auditoria', 'comunicados', 'propaganda', 'agentes', 'pwa',
  'usuarios', 'configuracoes',
]

// ── Credenciais de emergência via env (fallback legado) ───────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@sgapetro.cloud'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'sga@admin2026'
const ADMIN_NOME     = process.env.ADMIN_NOME     ?? 'Admin SGA'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenciais obrigatórias' }, { status: 400 })
    }

    let session: AdminSession | null = null

    // ── 1. Tenta autenticar via tabela admins (DB) ────────────────────────────
    try {
      const sql  = getDb()
      const rows = await sql`
        SELECT id, email, nome, senha_hash, is_master, menus_permitidos, ativo
        FROM   admins
        WHERE  email = ${email.toLowerCase().trim()}
        LIMIT  1
      `
      const row = rows[0]
      if (row && row.ativo && verifyPassword(password, String(row.senhaHash))) {
        session = {
          id:               String(row.id),
          email:            String(row.email),
          nome:             String(row.nome),
          role:             'admin',
          is_master:        Boolean(row.isMaster),
          menus_permitidos: row.isMaster ? ALL_MENUS : ((row.menusPermitidos as string[]) ?? []),
        }
      }
    } catch {
      // DB indisponível — cai no fallback abaixo
    }

    // ── 2. Fallback: credenciais legadas de env (admin@sgapetro.cloud) ────────
    if (!session) {
      const emailOk    = timingSafeEqual(email.toLowerCase().trim(), ADMIN_EMAIL.toLowerCase())
      const passwordOk = timingSafeEqual(password, ADMIN_PASSWORD)
      if (emailOk && passwordOk) {
        session = {
          email:            ADMIN_EMAIL,
          nome:             ADMIN_NOME,
          role:             'admin',
          is_master:        true,
          menus_permitidos: ALL_MENUS,
        }
      }
    }

    if (!session) {
      await new Promise(r => setTimeout(r, 300)) // throttle brute-force
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const token = await createSessionToken(session)

    const proto   = req.headers.get('x-forwarded-proto') ?? ''
    const isHttps = proto === 'https' || req.url.startsWith('https://')

    const res = NextResponse.json({ ok: true, nome: session.nome })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   isHttps,
      sameSite: 'lax',
      maxAge:   8 * 60 * 60,
      path:     '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
