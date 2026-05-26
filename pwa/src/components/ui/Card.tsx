import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps {
  children:   ReactNode
  className?: string
  onClick?:   () => void
  glass?:     boolean
  flat?:      boolean   // sem shadow (cards aninhados ou ênfase no border)
}

/**
 * Card — superfície padrão. shadow suave + border sutil.
 * Temas claros: shadow domina. Temas escuros: border domina. Ambos coexistem.
 */
export function Card({ children, className, onClick, glass = false, flat = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl transition-all duration-200',
        glass
          ? 'bg-ink/5 border border-ink/10 backdrop-blur-md'
          : flat
            ? 'bg-surface border border-rim'
            : 'bg-surface border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        onClick && 'cursor-pointer active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
