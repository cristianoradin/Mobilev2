'use client'
/**
 * MultiPicker — seletor multi com search + checkboxes + marcar todas.
 * Reusable pra qualquer lista (empresas, clientes, etc).
 */
import { useMemo, useState } from 'react'
import { Search, CheckSquare, Square, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PickerItem {
  id:        string | number
  label:     string
  subtitle?: string
  badge?:    string
  disabled?: boolean
}

interface Props<T extends PickerItem> {
  items:        T[]
  selectedIds:  Array<string | number>
  onChange:     (ids: Array<string | number>) => void
  label?:       string
  placeholder?: string
  emptyMessage?: string
  maxHeight?:   string
  className?:   string
}

export function MultiPicker<T extends PickerItem>({
  items, selectedIds, onChange,
  label,
  placeholder    = 'Buscar…',
  emptyMessage   = 'Sem itens',
  maxHeight      = '240px',
  className,
}: Props<T>) {
  const [search, setSearch] = useState('')

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return items
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.subtitle?.toLowerCase().includes(q) ?? false),
    )
  }, [items, search])

  function toggle(id: string | number) {
    onChange(selectedSet.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  function toggleAllFiltered() {
    const allFilteredSelected = filtered.every(i => selectedSet.has(i.id))
    if (allFilteredSelected) {
      // Desmarca os filtrados
      const remove = new Set(filtered.map(i => i.id))
      onChange(selectedIds.filter(id => !remove.has(id)))
    } else {
      // Marca todos os filtrados (mantém os já selecionados fora do filtro)
      const next = new Set(selectedIds)
      filtered.forEach(i => { if (!i.disabled) next.add(i.id) })
      onChange(Array.from(next))
    }
  }

  const selectedCount   = selectedIds.length
  const totalCount      = items.length
  const filteredCount   = filtered.length
  const allFilteredSel  = filtered.length > 0 && filtered.every(i => selectedSet.has(i.id))

  return (
    <div className={cn('bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden', className)}>
      {label && (
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span className="text-white/50 text-[11px] uppercase tracking-wider font-semibold">{label}</span>
          <span className="text-[10px] text-white/40 tabular-nums">
            <span className={selectedCount > 0 ? 'text-emerald-400 font-semibold' : ''}>{selectedCount}</span>
            {' / '}{totalCount}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="px-2.5 py-2 border-b border-white/8 bg-white/[0.02] flex items-center gap-2">
        <Search size={12} className="text-white/30 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-xs placeholder:text-white/25 focus:outline-none"
        />
        {totalCount > 0 && (
          <button
            type="button"
            onClick={toggleAllFiltered}
            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-emerald-400 transition-colors flex-shrink-0"
            title={allFilteredSel ? 'Desmarcar todos' : 'Marcar todos'}
          >
            {allFilteredSel
              ? <CheckSquare size={12} className="text-emerald-400" />
              : <Square size={12} />
            }
            {allFilteredSel ? 'Desmarcar' : 'Marcar'} todos
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {filteredCount === 0 ? (
          <div className="px-3 py-6 text-center text-white/30 text-xs">
            {search ? `Nenhum resultado pra "${search}"` : emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(item => {
              const checked = selectedSet.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !item.disabled && toggle(item.id)}
                  disabled={item.disabled}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    checked
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                      : 'hover:bg-white/5',
                    item.disabled && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all',
                    checked
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-white/30',
                  )}>
                    {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-[13px] font-medium truncate',
                      checked ? 'text-emerald-300' : 'text-white/85',
                    )}>
                      {item.label}
                    </div>
                    {item.subtitle && (
                      <div className="text-[10px] text-white/40 truncate">{item.subtitle}</div>
                    )}
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedCount > 0 && (
        <div className="px-3 py-1.5 border-t border-white/8 bg-emerald-500/[0.04] flex items-center justify-between">
          <span className="text-emerald-400 text-[10px] font-semibold">
            {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-white/40 hover:text-red-400 transition-colors"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  )
}
