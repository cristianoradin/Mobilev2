export type ThemeName = 'modern' | 'glass' | 'minimal' | 'neon'

export interface Theme {
  bg: string
  card: string
  cardBorder: string
  text: string
  textSecondary: string
  isGlass?: boolean
}

export const themes: Record<ThemeName, Theme> = {
  modern: {
    bg: '#0a0a0a',
    card: '#1a1a1a',
    cardBorder: '#2a2a2a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
  },
  glass: {
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.1)',
    text: '#ffffff',
    textSecondary: '#a0aec0',
    isGlass: true,
  },
  minimal: {
    bg: '#f5f5f5',
    card: '#ffffff',
    cardBorder: '#e5e7eb',
    text: '#1a1a1a',
    textSecondary: '#6b7280',
  },
  neon: {
    bg: '#000000',
    card: '#0a0a0a',
    cardBorder: '#009c3b',
    text: '#ffffff',
    textSecondary: '#00ff6a',
  },
}

export const colors = {
  primary: '#009c3b',
  orange:  '#f97316',
  blue:    '#3b82f6',
  yellow:  '#fbbf24',
  danger:  '#ef4444',
  purple:  '#6366f1',
}
