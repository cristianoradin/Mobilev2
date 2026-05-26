import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'

// /agent/ — binários do agente servidos sem autenticação para download pelo agente no posto
// /sw.js   — service worker do portal (Web Push); precisa ser público para o browser registrar
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/agent/', '/sw.js']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas — passa direto
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Rotas de API internas — passa direto (protegidas individualmente se necessário)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Verifica sessão
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const session = await verifySessionToken(token)
  if (!session) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  return NextResponse.next()
}

export const config = {
  // Exclui assets estáticos do public/ além das rotas internas do Next.js
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|gif|woff2?|ttf|otf|webmanifest|txt|xml)$).*)'],
}
