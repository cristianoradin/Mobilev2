'use client'
import { ArrowRight } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { cn } from '@/lib/cn'
import type { ChartMetadata, ButtonWidgetItem, ButtonVariant, ButtonSize } from '@/lib/types'

// ── Botão individual ──────────────────────────────────────────────────────────
function PreviewButton({ btn }: { btn: ButtonWidgetItem }) {
  const Icon    = getIcon(btn.icon)
  const size:    ButtonSize    = btn.size    ?? 'md'
  const variant: ButtonVariant = btn.variant ?? 'primary'
  const color = btn.color  // cor customizada (opcional)

  const sizeCls: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2   text-sm gap-2   rounded-lg',
    lg: 'px-6 py-3   text-base gap-2.5 rounded-xl',
  }
  const iconSz: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 18 }

  // Se tem cor customizada, gera inline style e classe base mínima
  if (color) {
    return (
      <button
        className={cn(
          'inline-flex items-center font-medium transition-all duration-150 cursor-default text-white',
          sizeCls[size],
        )}
        style={{
          backgroundColor: color,
          boxShadow: `0 4px 14px ${color}40`,
        }}
      >
        {Icon && <Icon size={iconSz[size]} />}
        {btn.label}
        {btn.action.type === 'navigate' && (
          <ArrowRight size={iconSz[size]} className="opacity-50 ml-0.5" />
        )}
        {btn.action.type === 'url' && (
          <ArrowRight size={iconSz[size]} className="opacity-50 ml-0.5 rotate-[-45deg]" />
        )}
      </button>
    )
  }

  // Sem cor customizada — usa variante do design system
  const variantCls: Record<ButtonVariant, string> = {
    primary:   'bg-[#009c3b] hover:bg-[#00872f] text-white shadow-lg shadow-[#009c3b]/25',
    secondary: 'bg-white/8 hover:bg-white/12 text-white border border-white/12',
    danger:    'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20',
    ghost:     'hover:bg-white/8 text-white/70 hover:text-white',
  }

  return (
    <button className={cn(
      'inline-flex items-center font-medium transition-all duration-150 cursor-default',
      variantCls[variant],
      sizeCls[size],
    )}>
      {Icon && <Icon size={iconSz[size]} />}
      {btn.label}
      {btn.action.type === 'navigate' && (
        <ArrowRight size={iconSz[size]} className="opacity-40 ml-0.5" />
      )}
      {btn.action.type === 'url' && (
        <ArrowRight size={iconSz[size]} className="opacity-40 ml-0.5 rotate-[-45deg]" />
      )}
    </button>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
const LAYOUT_CLS: Record<string, string> = {
  horizontal: 'flex flex-row flex-wrap gap-3',
  vertical:   'flex flex-col gap-2 items-start',
  grid:       'grid grid-cols-2 gap-3',
}

const LAYOUT_LABELS: Record<string, string> = {
  horizontal: 'horizontal',
  vertical:   'vertical',
  grid:       'grade 2 colunas',
}

// ── Componente principal ──────────────────────────────────────────────────────
export function ButtonPreview({ metadata }: { metadata: ChartMetadata }) {
  const cfg     = metadata.button_config
  const buttons = cfg?.buttons ?? []
  const layout  = cfg?.layout  ?? 'horizontal'

  return (
    <div className="h-full flex flex-col bg-[#111]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className="text-white/40 text-xs">Preview — widget de ações</span>
        <span className="text-white/30 text-xs">
          {buttons.length} botão{buttons.length !== 1 ? 'ões' : ''} · layout {LAYOUT_LABELS[layout]}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {buttons.length === 0 ? (
          <p className="text-white/20 text-sm">Adicione ao menos um botão</p>
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5">
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium mb-4">
                Ações Rápidas
              </p>
              <div className={LAYOUT_CLS[layout] ?? LAYOUT_CLS.horizontal}>
                {buttons.map((btn, i) => (
                  <PreviewButton key={i} btn={btn} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
