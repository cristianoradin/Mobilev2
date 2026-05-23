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

  async function login(s: UserSession) {
    const db = await getDB()
    await db.put(DB_STORE, s, 'current')
    setSession(s)
  }

  async function logout() {
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
