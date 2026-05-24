'use client'
/**
 * Envia POST /api/auth/heartbeat a cada 2 minutos para registrar presença.
 * Deve ser renderizado dentro do layout autenticado.
 */
import { useEffect } from 'react'

export function HeartbeatProvider() {
  useEffect(() => {
    // Dispara imediatamente ao montar (login recente)
    const beat = () => fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {})
    beat()

    const id = setInterval(beat, 2 * 60 * 1000) // a cada 2 min
    return () => clearInterval(id)
  }, [])

  return null
}
