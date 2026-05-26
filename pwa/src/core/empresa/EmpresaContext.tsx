import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/core/auth/AuthContext'

interface Empresa {
  id: number
  nome: string
  is_master: boolean
  codigoErp?: number
  codigo_erp?: number
}

interface EmpresaContextValue {
  empresaSelecionada: Empresa | null
  empresasIds: number[]
  setEmpresaSelecionada: (e: Empresa | null) => void
  todas: boolean
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  // Se usuário tem apenas 1 empresa liberada, auto-seleciona — evita "Todas as Empresas"
  // como rótulo enganoso quando só existe 1 empresa.
  const empresasDoSession = session?.empresas ?? []
  const empresaUnica      = empresasDoSession.length === 1 ? empresasDoSession[0] : null
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(empresaUnica)

  const todas = empresaSelecionada === null
  // Usa codigoErp (código ERP local) quando disponível, senão o id do portal.
  // postgres.js transforma codigo_erp → codigoErp no response do pwa-login.
  const empresasIds = todas
    ? (session?.empresas ?? []).map(e => e.codigoErp ?? e.codigo_erp ?? e.id)
    : [empresaSelecionada.codigoErp ?? empresaSelecionada.codigo_erp ?? empresaSelecionada.id]

  return (
    <EmpresaContext.Provider value={{ empresaSelecionada, empresasIds, setEmpresaSelecionada, todas }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa must be inside EmpresaProvider')
  return ctx
}
