import { NavLink } from 'react-router-dom'
import { MENUS } from '@/lib/menus'
import { cn } from '@/lib/cn'

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-rim/60 pb-safe">
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1 max-w-lg mx-auto">
        {MENUS.map(({ id, label, route, icon: Icon }) => (
          <NavLink
            key={id}
            to={route}
            end={route === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-[48px]',
                isActive
                  ? 'bg-primary/15 text-primary scale-105'
                  : 'text-ink/40 hover:text-ink/70',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={cn('text-[10px] leading-tight', isActive ? 'font-semibold' : 'font-normal')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
