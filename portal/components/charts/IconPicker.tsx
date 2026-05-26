'use client'
/**
 * IconPicker — grid de ícones lucide + swatches de cor (fundo + ícone).
 * Salva em display.icon + display.icon_bg + display.icon_color.
 */
import { useState } from 'react'
import { ICON_REGISTRY, ICON_NAMES } from '@/lib/icons'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const BG_PALETTE = [
  { bg: '#C5E8D6', color: '#007538', label: 'Verde'   },
  { bg: '#C2DEFF', color: '#2D69B0', label: 'Azul'    },
  { bg: '#FFD9B3', color: '#D66820', label: 'Laranja' },
  { bg: '#FFEAB3', color: '#CC8F15', label: 'Amarelo' },
  { bg: '#DDD6FE', color: '#5B4DBC', label: 'Roxo'    },
  { bg: '#FBCFE8', color: '#B83280', label: 'Rosa'    },
  { bg: '#A7F3D0', color: '#047857', label: 'Esmeralda' },
  { bg: '#BAE6FD', color: '#0369A1', label: 'Ciano'   },
  { bg: '#FECACA', color: '#B91C1C', label: 'Vermelho' },
  { bg: '#E5E7EB', color: '#4B5563', label: 'Cinza'   },
]

interface Props {
  iconName?:  string
  iconBg?:    string
  iconColor?: string
  onChange:   (patch: { icon?: string; icon_bg?: string; icon_color?: string }) => void
}

export function IconPicker({ iconName, iconBg, iconColor, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const SelectedIcon = iconName ? ICON_REGISTRY[iconName] : null

  const effectiveBg    = iconBg    ?? '#C5E8D6'
  const effectiveColor = iconColor ?? '#007538'

  return (
    <div className="space-y-2">
      {/* Preview + abre/fecha */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: effectiveBg }}
        >
          {SelectedIcon
            ? <SelectedIcon size={26} color={effectiveColor} strokeWidth={2.2} />
            : <span className="text-white/30 text-xs">?</span>}
        </div>
        <div className="flex-1">
          <p className="text-white/70 text-xs">
            {iconName ?? 'Padrão por tipo'}
          </p>
          <p className="text-white/30 text-[10px]">
            {iconName ? 'Aparece no card do PWA' : 'Auto-escolhido pelo chart_type'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-white/50 hover:text-white text-xs px-3 py-1.5 rounded bg-white/5 border border-white/10 flex items-center gap-1.5"
        >
          {open ? 'Fechar' : 'Editar'}
          <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3 space-y-3">
          {/* Cores predefinidas */}
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Cor (combo bg + ícone)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {BG_PALETTE.map(p => {
                const active = effectiveBg === p.bg
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onChange({ icon_bg: p.bg, icon_color: p.color })}
                    title={p.label}
                    className={cn(
                      'h-9 rounded-lg flex items-center justify-center transition-all',
                      active ? 'ring-2 ring-white/40 scale-105' : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: p.bg }}
                  >
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-white/40 text-[10px] flex items-center gap-1.5 cursor-pointer">
                Bg custom
                <input type="color" value={effectiveBg} onChange={e => onChange({ icon_bg: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent" />
              </label>
              <label className="text-white/40 text-[10px] flex items-center gap-1.5 cursor-pointer">
                Ícone custom
                <input type="color" value={effectiveColor} onChange={e => onChange({ icon_color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent" />
              </label>
            </div>
          </div>

          {/* Grid de ícones */}
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Ícone</p>
            <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => onChange({ icon: undefined })}
                className={cn(
                  'h-9 rounded flex items-center justify-center text-[10px] transition-all',
                  !iconName ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-white/5 text-white/40 hover:bg-white/10',
                )}
                title="Sem ícone (usa default do chart_type)"
              >
                auto
              </button>
              {ICON_NAMES.map(name => {
                const Icon = ICON_REGISTRY[name]
                const active = iconName === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChange({ icon: name })}
                    title={name}
                    className={cn(
                      'h-9 rounded flex items-center justify-center transition-all',
                      active ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : 'bg-white/5 hover:bg-white/10',
                    )}
                  >
                    <Icon size={15} color={active ? '#10b981' : 'rgba(255,255,255,0.6)'} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
