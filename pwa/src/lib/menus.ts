/**
 * Categorias = Menus do PWA. Templates do portal recebem 1 categoria
 * e aparecem no menu correspondente.
 */
import type { ComponentType } from 'react'
import { Home, Fuel, Package, TrendingUp, DollarSign, Settings } from 'lucide-react'

export type MenuCategoria = 'iniciar' | 'pista' | 'estoque' | 'vendas' | 'financeiro' | 'operacoes'

export interface MenuMeta {
  id:      MenuCategoria
  label:   string
  route:   string
  icon:    ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

export const MENUS: MenuMeta[] = [
  { id: 'iniciar',    label: 'Iniciar',    route: '/',           icon: Home       },
  { id: 'pista',      label: 'Pista',      route: '/pista',      icon: Fuel       },
  { id: 'estoque',    label: 'Estoque',    route: '/estoque',    icon: Package    },
  { id: 'vendas',     label: 'Vendas',     route: '/vendas',     icon: TrendingUp },
  { id: 'financeiro', label: 'Financeiro', route: '/financeiro', icon: DollarSign },
  { id: 'operacoes',  label: 'Operações',  route: '/operacoes',  icon: Settings   },
]

export function getMenuByCategoria(c: string): MenuMeta | undefined {
  return MENUS.find(m => m.id === c)
}
