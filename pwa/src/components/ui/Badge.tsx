import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps {
  children: ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default'
  size?: 'sm' | 'md'
}

const variantClass = {
  success: 'bg-primary/20 text-primary',
  warning: 'bg-yellow/20 text-yellow',
  danger:  'bg-danger/20 text-danger',
  info:    'bg-blue/20 text-blue',
  default: 'bg-white/10 text-white/70',
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantClass[variant]
      )}
    >
      {children}
    </span>
  )
}
