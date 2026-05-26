'use client'
import { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

interface ConfirmModalProps {
  title:      string
  message:    ReactNode
  confirmLabel?: string
  cancelLabel?:  string
  variant?:   'default' | 'danger'
  onConfirm:  () => void
  onCancel:   () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variant      = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              variant === 'danger'
                ? 'bg-red-500/15 border border-red-500/25'
                : 'bg-[#009c3b]/15 border border-[#009c3b]/25'
            }`}>
              <AlertTriangle size={16} className={variant === 'danger' ? 'text-red-400' : 'text-[#009c3b]'} />
            </div>
            <h2 className="text-white font-semibold text-sm">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white transition-colors mt-0.5 ml-3">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5">
          <div className="text-white/60 text-sm leading-relaxed">
            {message}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className="flex-1 justify-center"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
