import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Sun, Moon } from 'lucide-react'
import { useTheme, THEMES } from '@/core/theme/ThemeContext'
import type { Theme } from '@/core/theme/ThemeContext'

export function AparenciaScreen() {
  const navigate            = useNavigate()
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

      {/* Grade de temas — 2 opções (dark/light) */}
      <div className="grid grid-cols-2 gap-4">
        {THEMES.map(t => {
          const active = theme === t.id
          const Icon   = t.id === 'dark' ? Moon : Sun

          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as Theme)}
              className="relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all active:scale-95"
              style={{
                borderColor: active ? t.accent : 'transparent',
                background: t.bg,
                boxShadow: active
                  ? `0 0 0 3px ${t.accent}25, 0 4px 12px rgba(0,0,0,0.12)`
                  : '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* Mini preview */}
              <div className="w-full h-24 flex flex-col gap-1 p-2 overflow-hidden" style={{ background: t.bg }}>
                {/* Header simulado */}
                <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md" style={{ background: t.surface }}>
                  <div className="w-3 h-3 rounded-sm" style={{ background: t.accent }} />
                  <div className="flex-1 h-1.5 rounded-sm opacity-40" style={{ background: t.ink }} />
                </div>

                {/* Cards simulados */}
                <div className="flex-1 grid grid-cols-2 gap-1">
                  <div className="rounded-md flex items-end p-1.5" style={{ background: t.surface }}>
                    <div className="w-full h-1.5 rounded-sm opacity-40" style={{ background: t.ink }} />
                  </div>
                  <div className="rounded-md flex items-end p-1.5" style={{ background: t.surface }}>
                    <div className="w-full h-1.5 rounded-sm" style={{ background: t.accent }} />
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="px-3 py-3 flex items-center gap-2.5" style={{ background: t.surface }}>
                <Icon size={16} style={{ color: t.accent }} />
                <div className="text-left">
                  <p className="text-[13px] font-bold" style={{ color: t.ink }}>{t.label}</p>
                  <p className="text-[10px] opacity-50" style={{ color: t.ink }}>{t.desc}</p>
                </div>
              </div>

              {/* Check ativo */}
              {active && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                  style={{ background: t.accent }}
                >
                  <Check size={12} strokeWidth={3} color="#ffffff" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-ink/40 text-xs text-center mt-4">
        Tema sincroniza com preferência do sistema na primeira vez.
      </p>
    </div>
  )
}
