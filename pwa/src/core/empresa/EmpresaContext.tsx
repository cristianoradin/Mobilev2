import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/core/auth/AuthContext'

interface Empresa {
  id: number
  nome: string
  is_master: boolean
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
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null)

  const todas = empresaSelecionada === null
  const empresasIds = todas
    ? (session?.empresas ?? []).map(e => e.id)
    : [empresaSelecionada.id]

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
