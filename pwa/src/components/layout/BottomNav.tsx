import { NavLink } from 'react-router-dom'
import { TrendingUp, Fuel, DollarSign, Shield, Settings } from 'lucide-react'
import { cn } from '@/lib/cn'

const items = [
  { to: '/vendas',  icon: TrendingUp, label: 'Vendas'  },
  { to: '/estoque', icon: Fuel,       label: 'Estoque' },
  { to: '/',        icon: DollarSign, label: 'Início',  exact: true },
  { to: '/auth',    icon: Shield,     label: 'Alertas' },
  { to: '/config',  icon: Settings,   label: 'Config'  },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-rim pb-safe transition-colors duration-200">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px]',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-ink/40 hover:text-ink/70'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
