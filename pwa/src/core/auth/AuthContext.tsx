import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { openDB } from 'idb'
import type { UserSession } from '@/lib/contracts'

interface AuthContextValue {
  session: UserSession | null
  login: (session: UserSession) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DB_NAME  = 'sga-petro'
const DB_STORE = 'session'

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE)
      }
    },
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Carrega sessão persistida do IndexedDB
  useEffect(() => {
    getDB()
      .then(db => db.get(DB_STORE, 'current'))
      .then((stored: UserSession | undefined) => {
        if (stored && stored.expires_at > Date.now()) {
          setSession(stored)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Escuta AUTO_LOGIN vindo do portal (iframe postMessage)
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.data?.type !== 'AUTO_LOGIN') return
      const s = ev.data?.session as UserSession | undefined
      if (!s?.jwt) return
      getDB()
        .then(db => db.put(DB_STORE, s, 'current'))
        .then(() => setSession(s))
        .catch(console.error)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function login(s: UserSession) {
    const db = await getDB()
    await db.put(DB_STORE, s, 'current')
    setSession(s)
  }

  async function logout() {
    // Revoga o token no servidor (incrementa token_version) — best-effort
    if (session?.jwt) {
      const portalUrl = import.meta.env.VITE_PORTAL_URL ?? ''
      fetch(`${portalUrl}/api/auth/pwa-logout`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.jwt}` },
      }).catch(() => {/* ignora falha de rede — token expira em 8h */})
    }
    const db = await getDB()
    await db.delete(DB_STORE, 'current')
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
