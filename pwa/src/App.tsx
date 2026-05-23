import { ThemeProvider }        from '@/core/theme/ThemeContext'
import { AuthProvider }         from '@/core/auth/AuthContext'
import { EmpresaProvider }      from '@/core/empresa/EmpresaContext'
import { MQTTProvider }         from '@/core/mqtt/MQTTContext'
import { NotificationProvider } from '@/core/notifications/NotificationProvider'
import { AppRouter }            from '@/router'

export default function App() {
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
