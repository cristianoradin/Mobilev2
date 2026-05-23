/**
 * NotificationProvider — ativa o hook useNotifications() dentro da árvore React.
 * Deve ficar DENTRO de MQTTProvider e AuthProvider.
 */
import type { ReactNode } from 'react'
import { useNotifications } from './useNotifications'

interface Props {
  children: ReactNode
}

function NotificationActivator() {
  useNotifications()
  return null
}

export function NotificationProvider({ children }: Props) {
  return (
    <>
      <NotificationActivator />
      {children}
    </>
  )
}
