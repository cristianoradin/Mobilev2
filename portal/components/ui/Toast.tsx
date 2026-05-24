'use client'
/**
 * Sistema de notificações toast — design system do portal SGA Petro.
 * Uso:
 *   const { toasts, toast, dismiss } = useToast()
 *   toast('Salvo com sucesso!')
 *   toast('Erro ao salvar', 'error')
 *   <Toaster toasts={toasts} onDismiss={dismiss} />
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id:      string
  message: string
  type:    ToastType
}

// ── Estilo por variante ────────────────────────────────────────────────────────
const VARIANT: Record<ToastType, {
  border: string
  bg:     string
  icon:   React.ElementType
  color:  string
}> = {
  success: { border: 'border-[#009c3b]/35', bg: 'bg-[#009c3b]/10',  icon: CheckCircle2,  color: 'text-[#00c853]'  },
  error:   { border: 'border-red-500/35',   bg: 'bg-red-500/10',    icon: XCircle,       color: 'text-red-400'    },
  warning: { border: 'border-yellow-500/35',bg: 'bg-yellow-500/10', icon: AlertTriangle, color: 'text-yellow-400' },
  info:    { border: 'border-blue-500/35',  bg: 'bg-blue-500/10',   icon: Info,          color: 'text-blue-400'   },
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(p => [...p.slice(-4), { id, message, type }])
    timers.current[id] = setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  // Limpa timers ao desmontar
  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  return { toasts, toast, dismiss }
}

// ── Renderer ───────────────────────────────────────────────────────────────────
export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts:    ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const v = VARIANT[t.type]
        const Icon = v.icon
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border backdrop-blur-md shadow-2xl min-w-[300px] max-w-md ${v.border} ${v.bg}`}
          >
            <Icon size={16} className={`${v.color} flex-shrink-0`} />
            <span className="text-white/90 text-sm flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 p-0.5 ml-1"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
