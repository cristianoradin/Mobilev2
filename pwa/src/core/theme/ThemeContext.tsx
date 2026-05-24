/**
 * ThemeContext — gerencia tema do PWA: dark | light | indigo.
 * Persiste no localStorage e aplica a classe correspondente no <html>.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'indigo' | 'aurora' | 'futura' | 'iphone' | 'sga'

export interface ThemeMeta {
  id:      Theme
  label:   string
  desc:    string
  bg:      string   // preview: fundo
  surface: string   // preview: card
  accent:  string   // preview: cor de destaque
  ink:     string   // preview: texto
}

export const THEMES: ThemeMeta[] = [
  {
    id:      'dark',
    label:   'Escuro',
    desc:    'Padrão SGA Petro',
    bg:      '#0a0a0a',
    surface: '#1a1a1a',
    accent:  '#009c3b',
    ink:     '#ffffff',
  },
  {
    id:      'light',
    label:   'Claro',
    desc:    'Fundo branco',
    bg:      '#f0f2f5',
    surface: '#ffffff',
    accent:  '#009c3b',
    ink:     '#111827',
  },
  {
    id:      'indigo',
    label:   'Índigo',
    desc:    'Corporativo Bold',
    bg:      '#0a0a2e',
    surface: '#12124a',
    accent:  '#fbbf24',
    ink:     '#ffffff',
  },
  {
    id:      'aurora',
    label:   'Aurora',
    desc:    'Galáxia Glass',
    bg:      '#13072e',
    surface: 'rgba(255,255,255,0.10)',
    accent:  '#a78bfa',
    ink:     '#f0e8ff',
  },
  {
    id:      'futura',
    label:   'Futura',
    desc:    'Terminal / Hacker',
    bg:      '#050a12',
    surface: '#091522',
    accent:  '#00e5ff',
    ink:     '#b8e0ff',
  },
  {
    id:      'iphone',
    label:   'iPhone',
    desc:    'iOS / Apple',
    bg:      '#f2f2f7',
    surface: '#ffffff',
    accent:  '#007aff',
    ink:     '#000000',
  },
  {
    id:      'sga',
    label:   'SGA',
    desc:    'Sistema SGA Petro',
    bg:      '#eff4f0',
    surface: '#ffffff',
    accent:  '#009c3b',
    ink:     '#0d1f10',
  },
]

interface ThemeContextValue {
  theme:       Theme
  setTheme:    (t: Theme) => void
  toggleTheme: () => void   // cicla dark → indigo → light → dark (backward compat)
  isDark:      boolean       // true para dark e indigo
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'sga-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (['dark','light','indigo','aurora','futura','iphone','sga'].includes(stored ?? '')) return stored as Theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove('dark', 'light', 'indigo', 'aurora', 'futura', 'iphone', 'sga')
  html.classList.add(theme)
}

const CYCLE: Theme[] = ['dark', 'indigo', 'aurora', 'futura', 'iphone', 'sga', 'light']

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => { applyTheme(getInitialTheme()) }, [])

  function setTheme(t: Theme) { setThemeState(t) }

  function toggleTheme() {
    setThemeState(prev => {
      const idx = CYCLE.indexOf(prev)
      return CYCLE[(idx + 1) % CYCLE.length]
    })
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      isDark: !['light', 'iphone', 'sga'].includes(theme),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
