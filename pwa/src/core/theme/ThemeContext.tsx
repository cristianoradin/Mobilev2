/**
 * ThemeContext — gerencia tema do PWA: dark | light.
 * Persiste no localStorage e aplica a classe correspondente no <html>.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeMeta {
  id:      Theme
  label:   string
  desc:    string
  bg:      string
  surface: string
  accent:  string
  ink:     string
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
    desc:    'Fundo branco — iOS style',
    bg:      '#F5F5F7',
    surface: '#FFFFFF',
    accent:  '#009c3b',
    ink:     '#1D1D1F',
  },
]

interface ThemeContextValue {
  theme:       Theme
  setTheme:    (t: Theme) => void
  toggleTheme: () => void
  isDark:      boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'sga-theme'
const VALID_THEMES: Theme[] = ['dark', 'light']

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored && VALID_THEMES.includes(stored)) return stored
  // Default: respeita preferência do sistema
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  // Remove tudo (inclusive temas antigos abandonados pra evitar sujeira)
  html.classList.remove('dark', 'light', 'indigo', 'aurora', 'futura', 'iphone', 'sga')
  html.classList.add(theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => { applyTheme(getInitialTheme()) }, [])

  function setTheme(t: Theme) {
    if (VALID_THEMES.includes(t)) setThemeState(t)
  }

  function toggleTheme() {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
