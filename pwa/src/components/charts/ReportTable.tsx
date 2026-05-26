/**
 * ReportTable — render tabular moderno baseado em report_config.
 * Visual: cards, hover, currency verde, mini bar de magnitude em numéricas,
 * zebra sutil, totais com destaque.
 */
import { useMemo } from 'react'
import type { ChartMetadata, ReportColumn } from '@/lib/contracts'
import { useTheme } from '@/core/theme/ThemeContext'
import { cn } from '@/lib/cn'

interface Props {
  metadata: ChartMetadata
  data:     Record<string, unknown>[]
  loading?: boolean
}

function parseNum(v: unknown): number {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return v
  return Number(String(v).replace(',', '.'))
}

function fmtCell(value: unknown, format?: string): string {
  const n = parseNum(value)
  if (value === null || value === undefined || value === '') return '—'

  if (format === 'currency') {
    return isNaN(n)
      ? String(value)
      : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (format === 'number') {
    return isNaN(n)
      ? String(value)
      : n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
  }
  if (format === 'percent') {
    return isNaN(n) ? String(value) : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
  }
  if (format === 'date' && !isNaN(Date.parse(String(value)))) {
    return new Date(String(value)).toLocaleDateString('pt-BR')
  }
  if (format === 'datetime' && !isNaN(Date.parse(String(value)))) {
    return new Date(String(value)).toLocaleString('pt-BR')
  }
  return String(value)
}

function alignCls(align?: string) {
  if (align === 'right')  return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

// Detecta se coluna deve mostrar mini-bar de magnitude (apenas numéricas)
function isNumericFormat(fmt?: string) {
  return fmt === 'currency' || fmt === 'number' || fmt === 'percent'
}

export function ReportTable({ metadata, data, loading = false }: Props) {
  const { isDark } = useTheme()
  const cfg  = metadata.report_config
  const cols = (cfg?.columns ?? []) as ReportColumn[]
  const showTots = cfg?.show_totals ?? cfg?.showTotals ?? false

  // Pré-computa max absoluto por coluna numérica pra escalar mini-bars
  const colMaxes = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of cols) {
      if (!isNumericFormat(c.format)) continue
      let max = 0
      for (const r of data) {
        const v = Math.abs(parseNum(r[c.field]))
        if (!isNaN(v) && v > max) max = v
      }
      map[c.field] = max
    }
    return map
  }, [cols, data])

  // Calcula totais
  const totals = useMemo(() => {
    if (!showTots) return {}
    const t: Record<string, number> = {}
    for (const col of cols) {
      if (col.summary === 'sum') {
        t[col.field] = data.reduce((acc, row) => {
          const v = parseNum(row[col.field])
          return acc + (isNaN(v) ? 0 : v)
        }, 0)
      }
    }
    return t
  }, [cols, data, showTots])

  if (!cols.length) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-ink/40">Carregando dados…</span>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="text-center py-12 text-sm text-ink/40">
        Nenhum dado disponível
      </div>
    )
  }

  // Paleta de cor pra mini-bar — primary com transparência (dark/light auto via CSS var)
  const barColor = isDark ? 'rgba(0,156,59,0.22)' : 'rgba(0,156,59,0.15)'

  return (
    <div className="rounded-2xl bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-rim/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          {/* Cabeçalho */}
          <thead>
            <tr className="border-b border-rim/60 bg-surface2/40">
              {cols.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink/45',
                    alignCls(col.align),
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Corpo */}
          <tbody className="divide-y divide-rim/30">
            {data.map((row, ri) => (
              <tr key={ri} className="group hover:bg-primary/[0.04] transition-colors">
                {cols.map((col, ci) => {
                  const raw = row[col.field]
                  const num = parseNum(raw)
                  const text = fmtCell(raw, col.format)
                  const isNum = isNumericFormat(col.format) && !isNaN(num)
                  const isFirst = ci === 0
                  const isCurrency = col.format === 'currency'

                  // Magnitude relativa (0..1) pra mini-bar
                  const max = colMaxes[col.field] ?? 0
                  const ratio = max > 0 ? Math.min(1, Math.abs(num) / max) : 0

                  return (
                    <td
                      key={ci}
                      className={cn(
                        'relative px-4 py-3 align-middle',
                        alignCls(col.align),
                        isFirst ? 'font-semibold text-ink' : 'tabular-nums',
                        isNum && 'font-mono',
                      )}
                    >
                      {/* Mini-bar de magnitude (numéricas, não-zero) */}
                      {isNum && ratio > 0 && (
                        <span
                          className="absolute inset-y-0 right-0 h-full pointer-events-none transition-all"
                          style={{
                            width:     `${ratio * 100}%`,
                            maxWidth:  'calc(100% - 8px)',
                            background: `linear-gradient(90deg, transparent, ${barColor})`,
                            borderRadius: '0 2px 2px 0',
                          }}
                        />
                      )}
                      {/* Conteúdo (acima da bar) */}
                      <span
                        className={cn(
                          'relative z-[1]',
                          isCurrency && 'text-primary font-semibold',
                          !isCurrency && isNum && 'text-ink/85',
                          !isNum && !isFirst && 'text-ink/70',
                          num < 0 && isNum && 'text-danger',
                        )}
                      >
                        {text}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          {/* Totais */}
          {showTots && Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-primary/[0.06]">
                {cols.map((col, ci) => {
                  const total = totals[col.field]
                  const showTotal = col.summary === 'sum'
                  return (
                    <td
                      key={ci}
                      className={cn(
                        'px-4 py-3 font-bold text-sm tabular-nums font-mono',
                        alignCls(col.align),
                      )}
                    >
                      {showTotal ? (
                        <span className={cn(
                          col.format === 'currency' && 'text-primary',
                          !col.format && 'text-ink',
                        )}>
                          {fmtCell(total, col.format)}
                        </span>
                      ) : ci === 0 ? (
                        <span className="text-primary/80 uppercase tracking-wider text-[11px]">Total</span>
                      ) : (
                        <span className="text-ink/20">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
