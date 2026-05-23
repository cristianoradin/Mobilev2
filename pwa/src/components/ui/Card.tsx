import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  glass?: boolean
}

export function Card({ children, className, onClick, glass = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl transition-all duration-200',
        glass
          ? 'bg-ink/5 border border-ink/10 backdrop-blur-md'
          : 'bg-surface border border-rim',
        onClick && 'cursor-pointer active:scale-[0.97] hover:brightness-[1.04]',
        className
      )}
    >
      {children}
    </div>
  )
}
