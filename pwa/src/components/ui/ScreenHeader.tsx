import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title:     string
  subtitle?: string
  action?:   ReactNode
}

/**
 * ScreenHeader — header padrão das screens internas (Vendas, Estoque, etc).
 * Visual consistente com Home: título 22, subtítulo cinza 13.
 */
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-ink leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-ink/45 text-[13px] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
