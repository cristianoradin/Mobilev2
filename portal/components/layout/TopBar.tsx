'use client'
import { Bell, Search } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/8 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg">{title}</h1>
          {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              placeholder="Buscar..."
              className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 w-52 transition-all"
            />
          </div>
          <button className="relative p-2 rounded-lg hover:bg-white/8 transition-colors">
            <Bell size={17} className="text-white/50" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#009c3b] rounded-full" />
          </button>
        </div>
      </div>
    </header>
  )
}
