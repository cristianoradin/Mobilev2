'use client'
import Link           from 'next/link'
import Image          from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart3, Key, FileText, Settings, LogOut,
  PanelsTopLeft, Smartphone, Bell, Cpu, Megaphone, UserCog,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const ALL_NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Visão Geral', key: 'dashboard'   },
  { href: '/dashboards',  icon: PanelsTopLeft,   label: 'Dashboards',  key: 'dashboards'  },
  { href: '/clientes',    icon: Users,           label: 'Clientes',    key: 'clientes'    },
  { href: '/graficos',    icon: BarChart3,       label: 'Gráficos',    key: 'graficos'    },
  { href: '/licencas',    icon: Key,             label: 'Licenças',    key: 'licencas'    },
  { href: '/auditoria',   icon: FileText,        label: 'Auditoria',   key: 'auditoria'   },
  { href: '/comunicados', icon: Bell,            label: 'Comunicados', key: 'comunicados' },
  { href: '/propaganda',  icon: Megaphone,       label: 'Propaganda',  key: 'propaganda'  },
  { href: '/agentes',     icon: Cpu,             label: 'Agentes',     key: 'agentes'     },
  { href: '/pwa',         icon: Smartphone,      label: 'PWA',         key: 'pwa'         },
  { href: '/usuarios',    icon: UserCog,         label: 'Usuários',    key: 'usuarios'    },
]

interface SidebarProps {
  /** null = master (vê tudo); array = menus permitidos */
  menusPermitidos: string[] | null
  isMaster: boolean
}

export function Sidebar({ menusPermitidos, isMaster }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  // null ou is_master → exibe tudo; senão filtra pelo array
  const navItems = (isMaster || menusPermitidos === null)
    ? ALL_NAV
    : ALL_NAV.filter(item => menusPermitidos.includes(item.key))

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-[#0a0a0a] border-r border-white/8 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/8">
        <Image
          src="/logo.png"
          alt="SGA Petro"
          width={120}
          height={32}
          className="h-8 w-auto object-contain"
          priority
        />
        <p className="text-white/30 text-[10px] mt-1.5 leading-tight">Admin Portal</p>
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
        {(isMaster || menusPermitidos === null || menusPermitidos.includes('configuracoes')) && (
          <Link
            href="/configuracoes"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <Settings size={16} strokeWidth={1.8} />
            Configurações
          </Link>
        )}
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
