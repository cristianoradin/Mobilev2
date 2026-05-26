'use client'
/**
 * SqlDataTable — viewer de resultados raw de SQL (preview via agente).
 * Features:
 *  - Limite visual configurável (default 100 linhas) + indicador "+N mais"
 *  - Right-align automático em colunas numéricas
 *  - Botão "Expandir" → modal fullscreen
 *  - Botão "Copiar JSON" → área de transferência
 *  - Sticky header + scroll vertical/horizontal
 */
import { useMemo, useState } from 'react'
import { Maximize2, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SqlDataResult {
  columns: string[]
  rows:    Record<string, unknown>[]
  count:   number
}

interface Props {
  data:        SqlDataResult
  className?:  string
  maxHeight?:  string   // ex: '400px' (default)
  rowLimit?:   number   // default 100
}

// Detecta se coluna é numérica (right-align)
function isNumericCol(rows: Record<string, unknown>[], col: string): boolean {
  let numeric = 0, total = 0
  for (const r of rows.slice(0, 20)) {
    const v = r[col]
    if (v == null) continue
    total++
    if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v))) numeric++
  }
  return total > 0 && numeric / total > 0.7
}

function formatCell(v: unknown): { display: string; isNull: boolean } {
  if (v == null) return { display: 'null', isNull: true }
  if (typeof v === 'object') return { display: JSON.stringify(v), isNull: false }
  return { display: String(v), isNull: false }
}

function TableInner({ data, rowLimit }: { data: SqlDataResult; rowLimit: number }) {
  const visible  = data.rows.slice(0, rowLimit)
  const hidden   = data.rows.length - visible.length
  const colAlign = useMemo(() => {
    const map: Record<string, 'left' | 'right'> = {}
    for (const c of data.columns) map[c] = isNumericCol(data.rows, c) ? 'right' : 'left'
    return map
  }, [data])

  return (
    <>
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-[#111] z-10">
          <tr>
            {data.columns.map(col => (
              <th
                key={col}
                className={cn(
                  'px-3 py-2.5 text-white/50 font-semibold whitespace-nowrap border-b border-white/10 border-r border-r-white/5 last:border-r-0',
                  colAlign[col] === 'right' ? 'text-right' : 'text-left',
                )}
              >
                <span className="font-mono text-[#009c3b]/80">{col}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.03]">
              {data.columns.map(col => {
                const f = formatCell(row[col])
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-3 py-1.5 whitespace-nowrap border-r border-r-white/5 last:border-r-0 font-mono max-w-[320px] truncate',
                      colAlign[col] === 'right' ? 'text-right' : 'text-left',
                      f.isNull ? 'text-white/20 italic' : 'text-white/80',
                    )}
                    title={f.display}
                  >
                    {f.display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div className="text-center text-white/30 text-xs py-3 border-t border-white/5 bg-[#0a0a0a]">
          +{hidden} linha{hidden > 1 ? 's' : ''} ocultas — clique em <span className="text-white/60">Expandir</span> pra ver tudo
        </div>
      )}
    </>
  )
}

export function SqlDataTable({ data, className, maxHeight = '400px', rowLimit = 100 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied,   setCopied]   = useState(false)

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data.rows, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard bloqueado */ }
  }

  return (
    <>
      {/* isolate + z-20 → isola stacking de elementos absolute do Monaco editor */}
      <div className={cn('relative z-20 isolate flex flex-col bg-[#0a0a0a] border-t border-white/8', className)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 bg-[#0c0c0c] flex-shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/60">
              <span className="text-emerald-400 font-semibold">{data.count}</span> linha{data.count !== 1 ? 's' : ''}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-white/60">
              <span className="text-blue-400 font-semibold">{data.columns.length}</span> coluna{data.columns.length !== 1 ? 's' : ''}
            </span>
            {data.count > rowLimit && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-amber-400/80">exibindo {rowLimit}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              title="Copiar JSON pra área de transferência"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              {copied ? 'Copiado' : 'JSON'}
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              title="Expandir em tela cheia"
            >
              <Maximize2 size={11} />
              Expandir
            </button>
          </div>
        </div>
        {/* Table */}
        <div className="overflow-auto" style={{ maxHeight }}>
          <TableInner data={data} rowLimit={rowLimit} />
        </div>
      </div>

      {/* Fullscreen modal */}
      {expanded && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm p-6 flex flex-col" onClick={() => setExpanded(false)}>
          <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="text-sm text-white/80">
                Dados retornados — <span className="text-emerald-400 font-semibold">{data.count}</span> linhas ×{' '}
                <span className="text-blue-400 font-semibold">{data.columns.length}</span> colunas
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/70"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar JSON'}
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {/* Sem rowLimit dentro do modal — mostra tudo */}
              <TableInner data={data} rowLimit={data.count} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
