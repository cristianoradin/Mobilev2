import { useEffect } from 'react'
import { ThemeProvider }        from '@/core/theme/ThemeContext'
import { AuthProvider }         from '@/core/auth/AuthContext'
import { EmpresaProvider }      from '@/core/empresa/EmpresaContext'
import { MQTTProvider }         from '@/core/mqtt/MQTTContext'
import { NotificationProvider } from '@/core/notifications/NotificationProvider'
import { AppRouter }            from '@/router'

// ── Auto-atualização do PWA ────────────────────────────────────────────────
// Quando o novo Service Worker assume o controle (via skipWaiting + clientsClaim),
// recarrega a página silenciosamente para carregar os novos assets.
function useSwAutoUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])
}

export default function App() {
  useSwAutoUpdate()

  return (
    <ThemeProvider>
      <AuthProvider>
        <EmpresaProvider>
          <MQTTProvider>
            <NotificationProvider>
              <AppRouter />
            </NotificationProvider>
          </MQTTProvider>
        </EmpresaProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
