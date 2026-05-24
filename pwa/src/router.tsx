import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { LoginScreen } from '@/screens/LoginScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { VendasScreen } from '@/screens/VendasScreen'
import { EstoqueScreen } from '@/screens/EstoqueScreen'
import { TrocaPrecoScreen } from '@/screens/TrocaPrecoScreen'
import { AutorizacoesScreen } from '@/screens/AutorizacoesScreen'
import { ConfigScreen }        from '@/screens/ConfigScreen'
import { UsuariosScreen }      from '@/screens/UsuariosScreen'
import { GraficosScreen }       from '@/screens/GraficosScreen'
import { GraficoDetailScreen }  from '@/screens/GraficoDetailScreen'
import { DashboardsScreen }     from '@/screens/DashboardsScreen'
import { NotificacoesScreen }  from '@/screens/NotificacoesScreen'
import { AparenciaScreen }     from '@/screens/AparenciaScreen'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true,        element: <HomeScreen />         },
      { path: 'vendas',     element: <VendasScreen />       },
      { path: 'estoque',    element: <EstoqueScreen />      },
      { path: 'preco',      element: <TrocaPrecoScreen />   },
      { path: 'auth',       element: <AutorizacoesScreen /> },
      { path: 'config',                  element: <ConfigScreen />         },
      { path: 'config/usuarios',        element: <UsuariosScreen />        },
      { path: 'config/notificacoes',    element: <NotificacoesScreen />    },
      { path: 'config/aparencia',       element: <AparenciaScreen />        },
      { path: 'graficos',          element: <GraficosScreen />       },
      { path: 'graficos/:id',    element: <GraficoDetailScreen /> },
      { path: 'dashboards',      element: <DashboardsScreen />     },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function AppRouter() {
  // Escuta postMessage do Service Worker (clique em notificação push)
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'NAVIGATE' && typeof event.data.route === 'string') {
        router.navigate(event.data.route)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  return <RouterProvider router={router} />
}
