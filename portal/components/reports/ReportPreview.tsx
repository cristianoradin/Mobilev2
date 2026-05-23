'use client'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ArrowUpDown, Hash } from 'lucide-react'
import { cn } from '@/lib/cn'
import type {
  ChartMetadata,
  ReportColumn,
  ReportColumnFormat,
  ReportSummaryFn,
} from '@/lib/types'

// ── helpers de mock ───────────────────────────────────────────────────────────
const MOCK_TEXT: Record<string, string[]> = {
  default:     ['Gasolina Comum', 'Diesel S-10', 'Etanol Hidratado', 'Gasolina Aditivada', 'GNV', 'Diesel S-500', 'Diesel Aditivado', 'Etanol Comum'],
  status:      ['Ativo', 'Ativo', 'Ativo', 'Pendente', 'Inativo', 'Ativo', 'Pendente', 'Ativo'],
  cliente:     ['Posto Central Ltda', 'Rede Petro Sul', 'Auto Posto BV', 'Posto Rodoviário MG', 'Posto Familiar ME', 'Postos Norte S.A.', 'Combustível & Cia', 'Petro Express'],
  posto:       ['Posto 01 — Centro', 'Posto 02 — Norte', 'Posto 03 — Sul', 'Posto 04 — Leste', 'Posto 05 — Oeste', 'Posto 06 — BR-116', 'Posto 07 — Rodoanel', 'Posto 08 — Marginal'],
}

function seededRnd(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function mockValue(col: ReportColumn, rowIndex: number): unknown {
  const s = seededRnd(rowIndex * 17 + col.field.charCodeAt(0))
  switch (col.format) {
    case 'currency': return 800 + s * 14000
    case 'number':   return Math.floor(s * 9000 + 100)
    case 'percent':  return +(s * 99 + 0.5).toFixed(1)
    case 'date':     return new Date(Date.now() - rowIndex * 86_400_000).toISOString()
    case 'datetime': return new Date(Date.now() - rowIndex * 3_600_000).toISOString()
    case 'badge': {
      const pool = MOCK_TEXT.status
      return pool[rowIndex % pool.length]
    }
    default: {
      const key = col.field.toLowerCase().includes('cliente') ? 'cliente'
        : col.field.toLowerCase().includes('posto')   ? 'posto'
        : 'default'
      return MOCK_TEXT[key]?.[rowIndex % 8] ?? `Item ${rowIndex + 1}`
    }
  }
}

// ── helpers de formatação ─────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtNumber(v: number) {
  return v.toLocaleString('pt-BR')
}

interface Rendered { text: string; badge?: 'success' | 'warning' | 'danger' | 'info' | 'default' }

function renderValue(value: unknown, format: ReportColumnFormat | undefined): Rendered {
  if (value === null || value === undefined) return { text: '—' }

  switch (format) {
    case 'currency': return { text: fmtCurrency(Number(value)) }
    case 'number':   return { text: fmtNumber(Number(value)) }
    case 'percent':  return { text: `${value}%` }
    case 'date':     return { text: new Date(String(value)).toLocaleDateString('pt-BR') }
    case 'datetime': return { text: new Date(String(value)).toLocaleString('pt-BR') }
    case 'badge': {
      const s = String(value)
      const variant =
        s === 'Ativo'    ? 'success' :
        s === 'Inativo'  ? 'danger'  :
        s === 'Pendente' ? 'warning' : 'default'
      return { text: s, badge: variant }
    }
    default: return { text: String(value) }
  }
}

// ── cálculo do rodapé de totais ───────────────────────────────────────────────
function calcFooter(fn: ReportSummaryFn | undefined, values: number[]): string | null {
  if (!fn || fn === 'none' || values.length === 0) return null
  switch (fn) {
    case 'sum':   return fmtCurrency(values.reduce((a, b) => a + b, 0))
    case 'avg':   return fmtCurrency(values.reduce((a, b) => a + b, 0) / values.length)
    case 'count': return String(values.length)
    case 'min':   return fmtCurrency(Math.min(...values))
    case 'max':   return fmtCurrency(Math.max(...values))
  }
}

// ── largura das colunas ───────────────────────────────────────────────────────
const WIDTHS: Record<string, string> = {
  xs:   'w-16',
  sm:   'w-24',
  md:   'w-36',
  lg:   'w-52',
  auto: '',
}

// ── componente principal ──────────────────────────────────────────────────────
interface Props { metadata: ChartMetadata }

const ROWS = 8

export function ReportPreview({ metadata }: Props) {
  const cfg = metadata.report_config

  const columns: ReportColumn[] = useMemo(() => {
    if (cfg?.columns?.length) return cfg.columns
    return [
      { field: 'produto',    label: 'Produto',       format: 'text',     align: 'left'  },
      { field: 'quantidade', label: 'Qtd (L)',        format: 'number',   align: 'right', summary: 'sum' },
      { field: 'total',      label: 'Total (R$)',     format: 'currency', align: 'right', summary: 'sum' },
      { field: 'margem',     label: 'Margem',         format: 'percent',  align: 'right', summary: 'avg' },
      { field: 'data',       label: 'Data',           format: 'date',     align: 'center' },
      { field: 'status',     label: 'Status',         format: 'badge',    align: 'center' },
    ]
  }, [cfg?.columns])

  const rows = useMemo(
    () => Array.from({ length: ROWS }, (_, i) =>
      Object.fromEntries(columns.map(c => [c.field, mockValue(c, i)]))
    ),
    [columns]
  )

  const showTotals  = cfg?.show_totals ?? true
  const showIndex   = cfg?.show_index  ?? false

  return (
    <div className="h-full flex flex-col bg-[#111111]">
      {/* Barra de contexto */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className="text-white/40 text-xs">Preview — dados mock</span>
        <span className="text-white/30 text-xs">relatório · {columns.length} colunas · {ROWS} linhas</span>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          {/* Cabeçalho */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#161616] border-b border-white/8">
              {showIndex && (
                <th className="px-3 py-3 text-left w-8">
                  <Hash size={10} className="text-white/25" />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.field}
                  className={cn(
                    'px-4 py-3 font-medium text-white/50 uppercase tracking-wider select-none',
                    col.align === 'right'  && 'text-right',
                    col.align === 'center' && 'text-center',
                    !col.align             && 'text-left',
                    WIDTHS[col.width ?? 'auto'],
                  )}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap"
                    style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                    {col.label}
                    <ArrowUpDown size={10} className="text-white/20 flex-shrink-0" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Corpo */}
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  'group transition-colors duration-100',
                  ri % 2 === 1 ? 'bg-white/[0.015]' : 'bg-transparent',
                  'hover:bg-[#009c3b]/[0.04]',
                )}
              >
                {showIndex && (
                  <td className="px-3 py-3 text-white/20 font-mono tabular-nums w-8">
                    {ri + 1}
                  </td>
                )}
                {columns.map(col => {
                  const raw      = row[col.field]
                  const rendered = renderValue(raw, col.format)
                  const isNum    = col.format === 'currency' || col.format === 'number' || col.format === 'percent'

                  return (
                    <td
                      key={col.field}
                      className={cn(
                        'px-4 py-3',
                        col.align === 'right'  && 'text-right',
                        col.align === 'center' && 'text-center',
                        !col.align             && 'text-left',
                      )}
                    >
                      {rendered.badge ? (
                        <Badge variant={rendered.badge} size="sm">{rendered.text}</Badge>
                      ) : (
                        <span className={cn(
                          isNum
                            ? 'font-mono tabular-nums text-white/85 group-hover:text-white transition-colors'
                            : 'text-white/65 group-hover:text-white/90 transition-colors',
                          col.format === 'currency' && 'text-[#4ade80]/90 group-hover:text-[#4ade80]',
                          col.format === 'date' || col.format === 'datetime' ? 'text-white/40 font-mono' : '',
                        )}>
                          {rendered.text}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          {/* Rodapé de totais */}
          {showTotals && (
            <tfoot>
              <tr className="bg-[#009c3b]/[0.07] border-t border-[#009c3b]/20">
                {showIndex && <td className="px-3 py-3" />}
                {columns.map((col, ci) => {
                  const numericVals = col.summary && col.summary !== 'none'
                    ? rows
                        .map(r => Number(r[col.field]))
                        .filter(n => !isNaN(n))
                    : []
                  const footer = calcFooter(col.summary, numericVals)

                  return (
                    <td
                      key={col.field}
                      className={cn(
                        'px-4 py-3',
                        col.align === 'right'  && 'text-right',
                        col.align === 'center' && 'text-center',
                        !col.align             && 'text-left',
                      )}
                    >
                      {ci === 0 && !showIndex && !footer && (
                        <span className="text-[#009c3b]/70 font-semibold uppercase tracking-wider text-[10px]">
                          Totais
                        </span>
                      )}
                      {footer && (
                        <span className="text-[#4ade80] font-mono font-semibold tabular-nums">
                          {footer}
                        </span>
                      )}
                      {!footer && ci !== 0 && (
                        <span className="text-white/15">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Rodapé informativo */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161616] border-t border-white/8 flex-shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-white/30">
          <span>{ROWS} registros simulados</span>
          {showTotals && <span>· rodapé de totais ativo</span>}
          {showIndex  && <span>· numeração de linhas ativa</span>}
        </div>
        <span className="text-[10px] text-white/20 font-mono">
          refresh: {metadata.query.refresh_seconds}s
        </span>
      </div>
    </div>
  )
}
