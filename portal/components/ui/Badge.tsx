'use client'
import { cn } from '@/lib/cn'
import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

const variantClass = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  danger:  'bg-red-500/15 text-red-400 border-red-500/20',
  info:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  default: 'bg-white/5 text-white/60 border-white/10',
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      variantClass[variant],
      className,
    )}>
      {children}
    </span>
  )
}
