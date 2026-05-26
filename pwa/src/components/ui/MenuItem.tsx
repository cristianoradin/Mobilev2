import type { ComponentType, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MenuItemProps {
  icon:       ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  iconBg:     string   // CSS color — usar tons pastel da paleta
  iconColor:  string   // cor do stroke do ícone
  title:      string
  subtitle:   string
  badge?:     ReactNode
  onClick:    () => void
  className?: string
}

/**
 * MenuItem — card de navegação do menu principal.
 * Visual: shadow suave + radius 16px + icon pastel quadrado (mockup Tela Home Mobile).
 */
export function MenuItem({
  icon: Icon, iconBg, iconColor, title, subtitle, badge, onClick, className,
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 bg-surface rounded-2xl p-4 text-left',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]',
        'border border-transparent hover:border-rim',
        'transition-all duration-200 active:scale-[0.98]',
        className,
      )}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={26} color={iconColor} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-ink font-semibold text-[17px] leading-tight">{title}</p>
          {badge}
        </div>
        <p className="text-ink/50 text-[13px] mt-0.5 leading-tight">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-ink/30 flex-shrink-0" />
    </button>
  )
}
