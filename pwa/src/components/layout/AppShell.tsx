import { Outlet } from 'react-router-dom'
import { Header }    from './Header'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-ink font-sans transition-colors duration-200">
      <Header />
      <main className="pb-24 pt-2 px-5 max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
