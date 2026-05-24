/**
 * GET /api/auth/online
 * Lista admins com last_seen_at nos últimos 5 minutos (= online).
 */
import { NextResponse } from 'next/server'
import { getDb }        from '@/lib/db'

export interface AdminOnline {
  id:           string
  nome:         string
  email:        string
  last_seen_at: string
}

export async function GET() {
  try {
    const sql  = getDb()
    const rows = await sql`
      SELECT id, nome, email, last_seen_at::text
      FROM   admins
      WHERE  ativo = true
        AND  last_seen_at > NOW() - INTERVAL '10 minutes'
      ORDER  BY last_seen_at DESC
    `
    const online: AdminOnline[] = rows.map(r => ({
      id:           r.id           as string,
      nome:         r.nome         as string,
      email:        r.email        as string,
      last_seen_at: r.lastSeenAt   as string,
    }))
    return NextResponse.json({ online })
  } catch (err) {
    console.error('[auth/online]', err)
    return NextResponse.json({ online: [] })
  }
}
