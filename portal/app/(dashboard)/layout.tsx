import { cookies }          from 'next/headers'
import { Sidebar }          from '@/components/layout/Sidebar'
import { HeartbeatProvider } from '@/components/layout/HeartbeatProvider'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token       = cookieStore.get(SESSION_COOKIE)?.value
  const session     = token ? await verifySessionToken(token) : null

  const menus     = session?.is_master ? null : (session?.menus_permitidos ?? [])
  const isMaster  = session?.is_master ?? false

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      <Sidebar menusPermitidos={menus} isMaster={isMaster} />
      <main className="flex-1 overflow-auto">{children}</main>
      {/* Mantém presença do admin atualizada em background */}
      <HeartbeatProvider />
    </div>
  )
}
