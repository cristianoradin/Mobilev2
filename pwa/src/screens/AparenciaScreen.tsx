import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { useTheme, THEMES } from '@/core/theme/ThemeContext'
import type { Theme } from '@/core/theme/ThemeContext'

export function AparenciaScreen() {
  const navigate          = useNavigate()
  const { theme, setTheme } = useTheme()

  return (
    <div className="pt-2 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/config')}
          className="p-2 -ml-2 rounded-xl hover:bg-ink/10 transition-colors"
        >
          <ChevronLeft size={20} className="text-ink/60" />
        </button>
        <div>
          <h1 className="text-ink font-bold text-lg">Aparência</h1>
          <p className="text-ink/40 text-xs">Escolha o visual do aplicativo</p>
        </div>
      </div>

      {/* Grade de temas */}
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map(t => {
          const active    = theme === t.id
          const isAurora  = t.id === 'aurora'
          const isFutura  = t.id === 'futura'
          const isIphone  = t.id === 'iphone'
          const isSga     = t.id === 'sga'

          const previewBg = isAurora
            ? 'linear-gradient(140deg,#13072e 0%,#1e0a4a 100%)'
            : isSga ? '#eff4f0'
            : t.bg

          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as Theme)}
              className="relative flex flex-col overflow-hidden border-2 transition-all active:scale-95"
              style={{
                borderRadius: isFutura ? '2px' : isAurora ? '24px' : isIphone ? '13px' : '12px',
                borderColor: active
                  ? t.accent
                  : isFutura ? 'rgba(0,229,255,0.25)'
                  : isIphone ? 'rgba(60,60,67,0.18)'
                  : 'rgba(255,255,255,0.08)',
                background: t.bg,
                boxShadow: active
                  ? isFutura
                    ? `0 0 16px 2px ${t.accent}60, 0 0 4px 1px ${t.accent}90`
                    : isIphone
                      ? `0 0 0 3px ${t.accent}30, 0 4px 12px rgba(0,0,0,0.12)`
                      : `0 0 12px 2px ${t.accent}50`
                  : isFutura ? '0 0 8px rgba(0,229,255,0.12)'
                  : isIphone ? '0 2px 8px rgba(0,0,0,0.08)'
                  : 'none',
              }}
            >
              {/* Mini preview */}
              <div
                className="w-full h-16 flex flex-col gap-0 overflow-hidden"
                style={{ background: previewBg }}
              >
                {/* Header simulado */}
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  style={{
                    background: isSga ? '#009c3b' : previewBg,
                    padding: '4px 8px',
                  }}
                >
                  <div className="w-3 h-3 flex-shrink-0"
                    style={{
                      borderRadius: isFutura ? '1px' : '3px',
                      background: isSga
                        ? 'rgba(255,255,255,0.30)'
                        : isAurora ? 'rgba(255,255,255,0.15)'
                        : isIphone ? 'rgba(242,242,247,0.9)'
                        : t.surface,
                      border: isFutura ? '1px solid rgba(0,229,255,0.4)' : 'none',
                    }} />
                  <div className="flex-1 h-1.5 opacity-70"
                    style={{
                      borderRadius: isFutura ? '1px' : '4px',
                      background: isSga
                        ? 'rgba(255,255,255,0.25)'
                        : isAurora ? 'rgba(255,255,255,0.12)'
                        : isIphone ? 'rgba(60,60,67,0.12)'
                        : t.surface,
                    }} />
                  <div className="w-2.5 h-2.5"
                    style={{
                      borderRadius: isFutura ? '1px' : '50%',
                      background: isSga ? 'rgba(255,255,255,0.35)' : t.accent,
                      boxShadow: isFutura ? `0 0 6px ${t.accent}` : 'none',
                    }} />
                </div>

                {/* Card simulado */}
                <div className="flex-1 flex items-end p-1.5 gap-1 mx-2 mb-1 mt-1"
                  style={{
                    borderRadius: isFutura ? '1px' : isIphone ? '10px' : '4px',
                    background: isAurora
                      ? 'rgba(255,255,255,0.10)'
                      : isIphone ? '#ffffff'
                      : t.surface,
                    backdropFilter: isAurora ? 'blur(4px)' : 'none',
                    border: isFutura
                      ? '1px solid rgba(0,229,255,0.35)'
                      : isIphone ? 'none'
                      : isSga ? '1px solid rgba(0,156,59,0.18)' : 'none',
                    boxShadow: isFutura
                      ? '0 0 6px rgba(0,229,255,0.15)'
                      : isIphone ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <div className="flex-1 h-1.5 rounded-sm opacity-50"
                    style={{ background: t.ink }} />
                  <div className="w-6 h-3 rounded-sm"
                    style={{ background: t.accent }} />
                </div>
              </div>

              {/* Label */}
              <div
                className="px-2.5 py-2"
                style={{
                  background: isAurora
                    ? 'rgba(255,255,255,0.07)'
                    : isIphone ? '#f2f2f7'
                    : t.surface,
                  backdropFilter: isAurora ? 'blur(8px)' : 'none',
                }}
              >
                <p className="text-[11px] font-bold" style={{ color: t.ink }}>{t.label}</p>
                <p className="text-[9px] opacity-50" style={{ color: t.ink }}>{t.desc}</p>
              </div>

              {/* Check ativo */}
              {active && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: t.accent }}
                >
                  <Check size={10} strokeWidth={3} color={t.bg === 'transparent' || t.bg === '#eff4f0' || t.bg === '#f2f2f7' ? '#ffffff' : t.bg} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
