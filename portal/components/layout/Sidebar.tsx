'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, BarChart3, Key, FileText, Settings, LogOut, Fuel, PanelsTopLeft, Smartphone } from 'lucide-react'
import { cn } from '@/lib/cn'

const navItems = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Visão Geral' },
  { href: '/dashboards',   icon: PanelsTopLeft,   label: 'Dashboards'  },
  { href: '/clientes',     icon: Users,           label: 'Clientes'    },
  { href: '/graficos',     icon: BarChart3,       label: 'Gráficos'    },
  { href: '/licencas',     icon: Key,             label: 'Licenças'    },
  { href: '/auditoria',    icon: FileText,        label: 'Auditoria'   },
  { href: '/pwa',          icon: Smartphone,      label: 'PWA'         },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-[#0a0a0a] border-r border-white/8 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#009c3b] rounded-xl flex items-center justify-center shadow-lg shadow-[#009c3b]/30">
            <Fuel size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">SGA Petro</p>
            <p className="text-white/40 text-[10px] leading-tight">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-[#009c3b]/15 text-[#009c3b] border border-[#009c3b]/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/8 space-y-0.5">
        <Link href="/configuracoes" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all">
          <Settings size={16} strokeWidth={1.8} />
          Configurações
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/8 transition-all"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  )
}
