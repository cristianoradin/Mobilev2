'use client'
/**
 * ChartSuggestions — analisa o resultado do SQL e sugere chart_types
 * que se encaixam. Click em sugestão = troca tipo + auto-fill config.
 * Heurísticas baseadas nas colunas e amostra de linhas.
 */
import { useMemo } from 'react'
import {
  Sparkles, BarChart3, Activity, PieChart, Gauge, TrendingUp,
  TableProperties, Flame, Layers, Fuel, MousePointerClick,
} from 'lucide-react'
import type { ChartType } from '@/lib/types'
import { cn } from '@/lib/cn'

interface SuggestResult {
  type:        ChartType
  label:       string
  reason:      string
  confidence:  number       // 0..1
  icon:        typeof BarChart3
  color:       string
}

interface Props {
  columns: string[]
  rows:    Record<string, unknown>[]
  current: ChartType
  onPick:  (t: ChartType) => void
}

const TYPE_META: Record<ChartType, { label: string; icon: typeof BarChart3; color: string }> = {
  area:       { label: 'Área',       icon: TrendingUp,         color: '#009c3b' },
  line:       { label: 'Linha',      icon: Activity,           color: '#009c3b' },
  bar:        { label: 'Barras',     icon: BarChart3,          color: '#009c3b' },
  pie:        { label: 'Pizza',      icon: PieChart,           color: '#3b82f6' },
  gauge:      { label: 'Gauge',      icon: Gauge,              color: '#a855f7' },
  report:     { label: 'Relatório',  icon: TableProperties,    color: '#3b82f6' },
  kpi:        { label: 'KPI Card',   icon: Flame,              color: '#f59e0b' },
  heatmap:    { label: 'Heatmap',    icon: Layers,             color: '#8b5cf6' },
  waterfall:  { label: 'Waterfall',  icon: BarChart3,          color: '#06b6d4' },
  button:     { label: 'Botões',     icon: MousePointerClick,  color: '#f43f5e' },
  tank:       { label: 'Tanques',    icon: Fuel,               color: '#009c3b' },
  multiblock: { label: 'Multibloco', icon: Layers,             color: '#a855f7' },
}

// ── Heurísticas de detecção de tipo de coluna ──────────────────────────────
function isNumericCol(rows: Record<string, unknown>[], col: string): boolean {
  let numeric = 0, total = 0
  for (const r of rows.slice(0, 30)) {
    const v = r[col]
    if (v == null) continue
    total++
    if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v))) numeric++
  }
  return total > 0 && numeric / total > 0.7
}

function isDateCol(rows: Record<string, unknown>[], col: string): boolean {
  if (/data|date|dia|mes|ano|created|updated|hora/i.test(col)) {
    let dates = 0, total = 0
    for (const r of rows.slice(0, 10)) {
      const v = r[col]
      if (v == null) continue
      total++
      if (v instanceof Date) dates++
      else if (typeof v === 'string' && !isNaN(Date.parse(v))) dates++
    }
    return total > 0 && dates / total > 0.7
  }
  return false
}

function looksLikeTank(columns: string[]): boolean {
  const lc = columns.map(c => c.toLowerCase())
  const hasProduto    = lc.some(c => /produto|nome|combustivel|combustível/.test(c))
  const hasVolume     = lc.some(c => /volume|atual|estoque|litros/.test(c))
  const hasCapacidade = lc.some(c => /capacidade|capacity|total|max/.test(c))
  return hasProduto && hasVolume && hasCapacidade
}

// ── Engine principal ────────────────────────────────────────────────────────
function suggest(columns: string[], rows: Record<string, unknown>[]): SuggestResult[] {
  if (!columns.length) return []

  const numericCols = columns.filter(c => isNumericCol(rows, c))
  const textCols    = columns.filter(c => !numericCols.includes(c) && !isDateCol(rows, c))
  const dateCols    = columns.filter(c => isDateCol(rows, c))
  const rowCount    = rows.length

  const out: SuggestResult[] = []

  // Tanques — match forte de schema
  if (looksLikeTank(columns)) {
    out.push({
      type: 'tank', confidence: 0.95,
      reason: 'Colunas batem com produto/volume/capacidade',
      ...TYPE_META.tank,
    })
  }

  // Multibloco — 1+ texto + 2+ numéricas + poucas/médias linhas → tela rica
  if (textCols.length >= 1 && numericCols.length >= 2 && rowCount >= 2 && rowCount <= 100) {
    out.push({
      type: 'multiblock', confidence: 0.9,
      reason: `${textCols.length} categórica + ${numericCols.length} numéricas → KPIs + donut + tabela`,
      ...TYPE_META.multiblock,
    })
  }

  // Donut/Pizza — 1 texto + 1+ numérica + poucas linhas (<=15)
  if (textCols.length === 1 && numericCols.length >= 1 && rowCount <= 15) {
    out.push({
      type: 'pie', confidence: 0.85,
      reason: `${textCols[0]} agrupa ${numericCols[0]}`,
      ...TYPE_META.pie,
    })
  }

  // Linha/Área — coluna data + numéricas
  if (dateCols.length >= 1 && numericCols.length >= 1) {
    out.push({
      type: 'area', confidence: 0.9,
      reason: `Série temporal por ${dateCols[0]}`,
      ...TYPE_META.area,
    })
    out.push({
      type: 'line', confidence: 0.75,
      reason: `Tendência ao longo de ${dateCols[0]}`,
      ...TYPE_META.line,
    })
  }

  // KPI — agregação (1 linha) com várias numéricas
  if (rowCount <= 2 && numericCols.length >= 2) {
    out.push({
      type: 'kpi', confidence: 0.95,
      reason: `${numericCols.length} métricas agregadas → KPI Cards`,
      ...TYPE_META.kpi,
    })
  }

  // Barras — 1 texto + 1 numérica + linhas razoáveis
  if (textCols.length >= 1 && numericCols.length >= 1 && rowCount <= 30) {
    out.push({
      type: 'bar', confidence: 0.7,
      reason: `Comparativo ${textCols[0]} × ${numericCols[0]}`,
      ...TYPE_META.bar,
    })
  }

  // Gauge — 1 valor numérico (1 linha, 1 col numérica)
  if (rowCount === 1 && numericCols.length === 1) {
    out.push({
      type: 'gauge', confidence: 0.7,
      reason: `Métrica única ${numericCols[0]}`,
      ...TYPE_META.gauge,
    })
  }

  // Relatório — sempre cabe; confiança alta se muitas linhas/cols
  out.push({
    type: 'report',
    confidence: rowCount > 30 || columns.length > 5 ? 0.85 : 0.5,
    reason: `${rowCount} linhas × ${columns.length} colunas — visualização tabular`,
    ...TYPE_META.report,
  })

  // Heatmap — 2 texto + 1 numérica (matriz)
  if (textCols.length >= 2 && numericCols.length >= 1) {
    out.push({
      type: 'heatmap', confidence: 0.6,
      reason: `Matriz ${textCols[0]} × ${textCols[1]}`,
      ...TYPE_META.heatmap,
    })
  }

  // Ordena por confiança decrescente + dedupe
  const seen = new Set<ChartType>()
  return out
    .sort((a, b) => b.confidence - a.confidence)
    .filter(s => !seen.has(s.type) && (seen.add(s.type), true))
    .slice(0, 6)
}

export function ChartSuggestions({ columns, rows, current, onPick }: Props) {
  const suggestions = useMemo(() => suggest(columns, rows), [columns, rows])

  if (!suggestions.length) return null

  return (
    <div className="border-t border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5 flex-shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} className="text-amber-400" />
        <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">
          Sugestões de visualização
        </span>
        <span className="text-[10px] text-white/30">— click pra trocar tipo + auto-preencher</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map(s => {
          const Icon = s.icon
          const isActive = current === s.type
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => onPick(s.type)}
              title={s.reason}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                isActive
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
              )}
            >
              <Icon size={11} style={{ color: s.color }} />
              {s.label}
              <span className={cn('text-[9px] tabular-nums', isActive ? 'text-emerald-400/60' : 'text-white/30')}>
                {Math.round(s.confidence * 100)}%
              </span>
              {isActive && <span className="text-[9px] text-emerald-400">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
