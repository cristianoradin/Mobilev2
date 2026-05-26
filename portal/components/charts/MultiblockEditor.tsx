'use client'
/**
 * MultiblockEditor — interface pra adicionar/remover/configurar blocos
 * dentro de um template chart_type='multiblock'.
 */
import { useState } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp, GripVertical,
  Activity, PieChart, BarChart3, Table as TableIcon,
} from 'lucide-react'
import type {
  MultiblockConfig, MultiBlock, MbKpiBlock, MbDonutBlock, MbTableBlock, MbBarBlock,
  AggregateFn, KpiFormat,
} from '@/lib/types'
import { cn } from '@/lib/cn'

interface Props {
  config:    MultiblockConfig | undefined
  onChange:  (cfg: MultiblockConfig) => void
  /** Colunas disponíveis (de sqlResult.columns) — pra preencher dropdowns */
  columns:   string[]
}

const DEFAULT_KPI: MbKpiBlock     = { type: 'kpi',    title: 'Total',    field: '', agg: 'sum', format: 'currency' }
const DEFAULT_DONUT: MbDonutBlock = { type: 'donut',  title: 'Por categoria', groupBy: '', valueField: '', valueAgg: 'sum', showLegend: true }
const DEFAULT_TABLE: MbTableBlock = { type: 'table',  title: 'Detalhes', columns: [], showTotals: true, maxRows: 20 }
const DEFAULT_BAR: MbBarBlock     = { type: 'bar',    title: 'Comparativo', xField: '', yField: '', yAgg: 'sum' }

const BLOCK_META: Record<MultiBlock['type'], { label: string; icon: typeof Activity; color: string }> = {
  kpi:   { label: 'KPI',         icon: Activity, color: '#009c3b' },
  donut: { label: 'Donut/Pizza', icon: PieChart, color: '#3b82f6' },
  table: { label: 'Tabela',      icon: TableIcon, color: '#a855f7' },
  bar:   { label: 'Barras',      icon: BarChart3, color: '#f97316' },
}

export function MultiblockEditor({ config, onChange, columns }: Props) {
  const blocks = config?.blocks ?? []

  function set(newBlocks: MultiBlock[]) {
    onChange({ blocks: newBlocks, layout: config?.layout ?? { preset: 'kpis-top' } })
  }

  function add(type: MultiBlock['type']) {
    const tpl =
      type === 'kpi'   ? { ...DEFAULT_KPI }   :
      type === 'donut' ? { ...DEFAULT_DONUT } :
      type === 'table' ? { ...DEFAULT_TABLE, columns: columns.map(c => ({ field: c, label: c, format: 'text' as const, align: 'left' as const })) } :
                         { ...DEFAULT_BAR }
    set([...blocks, tpl])
  }

  function update(idx: number, patch: Partial<MultiBlock>) {
    const next = [...blocks]
    next[idx] = { ...next[idx], ...patch } as MultiBlock
    set(next)
  }

  function remove(idx: number) {
    set(blocks.filter((_, i) => i !== idx))
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    set(next)
  }

  return (
    <div className="space-y-3">
      {/* Add buttons */}
      <div className="flex flex-wrap gap-1.5">
        {(['kpi', 'donut', 'table', 'bar'] as const).map(t => {
          const m = BLOCK_META[t]
          const Icon = m.icon
          return (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/70 border border-white/8 transition-all"
            >
              <Plus size={11} />
              <Icon size={11} style={{ color: m.color }} />
              {m.label}
            </button>
          )
        })}
      </div>

      {blocks.length === 0 && (
        <p className="text-white/30 text-xs italic py-4 text-center">
          Adicione blocos clicando acima. 1 SQL no editor → todos os blocos usam os mesmos dados.
        </p>
      )}

      {blocks.map((b, i) => (
        <BlockCard
          key={i}
          block={b}
          index={i}
          total={blocks.length}
          columns={columns}
          onChange={patch => update(i, patch)}
          onRemove={() => remove(i)}
          onMove={dir => move(i, dir)}
        />
      ))}
    </div>
  )
}

// ── Card de cada bloco ──────────────────────────────────────────────────────
function BlockCard({
  block, index, total, columns, onChange, onRemove, onMove,
}: {
  block: MultiBlock
  index: number
  total: number
  columns: string[]
  onChange: (p: Partial<MultiBlock>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const m = BLOCK_META[block.type]
  const Icon = m.icon

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/8">
        <Icon size={12} style={{ color: m.color }} />
        <span className="text-white/80 text-xs font-semibold flex-1">
          {m.label} #{index + 1}
        </span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
          className="p-1 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronUp size={12} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
          className="p-1 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed">
          <ChevronDown size={12} />
        </button>
        <button type="button" onClick={onRemove}
          className="p-1 text-white/40 hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Body — campos específicos por tipo */}
      <div className="p-3 space-y-2">
        {block.type === 'kpi'   && <KpiFields   block={block} cols={columns} onChange={onChange} />}
        {block.type === 'donut' && <DonutFields block={block} cols={columns} onChange={onChange} />}
        {block.type === 'bar'   && <BarFields   block={block} cols={columns} onChange={onChange} />}
        {block.type === 'table' && <TableFields block={block} cols={columns} onChange={onChange} />}
      </div>
    </div>
  )
}

const FIELD = "w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#009c3b]/40"
const LABEL = "block text-white/40 text-[10px] uppercase tracking-wider mb-0.5"

function KpiFields({ block, cols, onChange }: { block: MbKpiBlock; cols: string[]; onChange: (p: Partial<MbKpiBlock>) => void }) {
  return (
    <>
      <div>
        <label className={LABEL}>Título</label>
        <input className={FIELD} value={block.title} onChange={e => onChange({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Coluna (campo)</label>
          <FieldSelect value={block.field} cols={cols} onChange={field => onChange({ field })} />
        </div>
        <div>
          <label className={LABEL}>Agregação</label>
          <select className={FIELD} value={block.agg} onChange={e => onChange({ agg: e.target.value as AggregateFn })}>
            {(['sum','avg','min','max','count','first','last'] as AggregateFn[]).map(a => <option key={a} value={a} className="bg-[#111]">{a}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Formato</label>
          <select className={FIELD} value={block.format} onChange={e => onChange({ format: e.target.value as KpiFormat })}>
            {(['number','currency','percent','litros','text'] as KpiFormat[]).map(f => <option key={f} value={f} className="bg-[#111]">{f}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Cor</label>
          <input type="color" className="w-full h-[30px] bg-transparent rounded cursor-pointer" value={block.color ?? '#009c3b'} onChange={e => onChange({ color: e.target.value })} />
        </div>
      </div>
    </>
  )
}

function DonutFields({ block, cols, onChange }: { block: MbDonutBlock; cols: string[]; onChange: (p: Partial<MbDonutBlock>) => void }) {
  return (
    <>
      <div>
        <label className={LABEL}>Título</label>
        <input className={FIELD} value={block.title} onChange={e => onChange({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Agrupar por</label>
          <FieldSelect value={block.groupBy} cols={cols} onChange={groupBy => onChange({ groupBy })} />
        </div>
        <div>
          <label className={LABEL}>Campo valor</label>
          <FieldSelect value={block.valueField} cols={cols} onChange={valueField => onChange({ valueField })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Top N (vazio = todos)</label>
          <input type="number" className={FIELD} value={block.topN ?? ''} onChange={e => onChange({ topN: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-white/70 text-xs cursor-pointer">
            <input type="checkbox" checked={block.showLegend !== false} onChange={e => onChange({ showLegend: e.target.checked })} />
            Mostrar legenda
          </label>
        </div>
      </div>
    </>
  )
}

function BarFields({ block, cols, onChange }: { block: MbBarBlock; cols: string[]; onChange: (p: Partial<MbBarBlock>) => void }) {
  return (
    <>
      <div>
        <label className={LABEL}>Título</label>
        <input className={FIELD} value={block.title} onChange={e => onChange({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Eixo X (campo)</label>
          <FieldSelect value={block.xField} cols={cols} onChange={xField => onChange({ xField })} />
        </div>
        <div>
          <label className={LABEL}>Eixo Y (campo)</label>
          <FieldSelect value={block.yField} cols={cols} onChange={yField => onChange({ yField })} />
        </div>
        <div>
          <label className={LABEL}>Orientação</label>
          <select className={FIELD} value={block.orientation ?? 'v'} onChange={e => onChange({ orientation: e.target.value as 'h' | 'v' })}>
            <option value="v" className="bg-[#111]">Vertical</option>
            <option value="h" className="bg-[#111]">Horizontal</option>
          </select>
        </div>
      </div>
    </>
  )
}

function TableFields({ block, cols, onChange }: { block: MbTableBlock; cols: string[]; onChange: (p: Partial<MbTableBlock>) => void }) {
  function autoFill() {
    onChange({
      columns: cols.map(c => ({
        field: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        format: /valor|preco|total|fat|receita/i.test(c) ? 'currency'
              : /qtd|quantidade|count|num/i.test(c)      ? 'number'
              : /percent|pct|margem/i.test(c)            ? 'percent'
              : 'text',
        align: /valor|preco|total|fat|receita|qtd|count|num|percent|pct|margem/i.test(c) ? 'right' : 'left',
      })),
    })
  }

  return (
    <>
      <div>
        <label className={LABEL}>Título (opcional)</label>
        <input className={FIELD} value={block.title ?? ''} onChange={e => onChange({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Limite de linhas</label>
          <input type="number" className={FIELD} value={block.maxRows ?? 20} onChange={e => onChange({ maxRows: Number(e.target.value) })} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-white/70 text-xs cursor-pointer">
            <input type="checkbox" checked={block.showTotals !== false} onChange={e => onChange({ showTotals: e.target.checked })} />
            Mostrar totais
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{block.columns.length} coluna(s) configurada(s)</span>
        <button type="button" onClick={autoFill}
          className="text-[#009c3b] hover:text-[#00b548]">
          Auto-preencher das {cols.length} colunas do SQL
        </button>
      </div>
    </>
  )
}

function FieldSelect({ value, cols, onChange }: { value: string; cols: string[]; onChange: (v: string) => void }) {
  return (
    <select className={FIELD} value={value} onChange={e => onChange(e.target.value)}>
      <option value="" className="bg-[#111]">— selecionar —</option>
      {cols.map(c => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
    </select>
  )
}
