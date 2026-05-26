/**
 * DateRangeFilter — picker mobile com presets + range custom.
 * Mudanças ficam em rascunho até clicar "Aplicar" → dispara fetch + fecha.
 * Persiste seleção aplicada em localStorage por template_id.
 */
import { useState, useEffect, useMemo } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import type { DatePreset, TemplateDateFilter } from '@/lib/contracts'
import { cn } from '@/lib/cn'

interface Props {
  templateId: string
  filter:     TemplateDateFilter
  onChange:   (from: string, to: string) => void
  className?: string
}

interface DateRange {
  from:   string   // YYYY-MM-DD
  to:     string
  preset: DatePreset
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today:      'Hoje',
  yesterday:  'Ontem',
  last_7d:    '7 dias',
  last_30d:   '30 dias',
  this_month: 'Este mês',
  last_month: 'Mês passado',
  custom:     'Personalizado',
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function presetRange(preset: DatePreset, defaults?: { from?: string; to?: string }): { from: string; to: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  switch (preset) {
    case 'today':     return { from: ymd(today), to: ymd(today) }
    case 'yesterday': {
      const d = new Date(today); d.setDate(d.getDate() - 1)
      return { from: ymd(d), to: ymd(d) }
    }
    case 'last_7d': {
      const d = new Date(today); d.setDate(d.getDate() - 6)
      return { from: ymd(d), to: ymd(today) }
    }
    case 'last_30d': {
      const d = new Date(today); d.setDate(d.getDate() - 29)
      return { from: ymd(d), to: ymd(today) }
    }
    case 'this_month': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: ymd(d), to: ymd(today) }
    }
    case 'last_month': {
      const d1 = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const d2 = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: ymd(d1), to: ymd(d2) }
    }
    case 'custom':
      return { from: defaults?.from ?? ymd(today), to: defaults?.to ?? ymd(today) }
  }
}

function fmtBR(d: string): string {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to && a.preset === b.preset
}

export function DateRangeFilter({ templateId, filter, onChange, className }: Props) {
  const storageKey = `date-range:${templateId}`

  const initial = useMemo<DateRange>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as DateRange
    } catch { /* ignore */ }
    const p = filter.default_preset
    const r = presetRange(p, { from: filter.default_from, to: filter.default_to })
    return { ...r, preset: p }
  }, [templateId, filter.default_preset, filter.default_from, filter.default_to, storageKey])

  // applied = o que está rodando, draft = o que user está editando
  const [applied,  setApplied]  = useState<DateRange>(initial)
  const [draft,    setDraft]    = useState<DateRange>(initial)
  const [expanded, setExpanded] = useState(false)

  // Dispara fetch quando applied muda
  useEffect(() => {
    onChange(applied.from, applied.to)
    try { localStorage.setItem(storageKey, JSON.stringify(applied)) } catch { /* quota */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.from, applied.to])

  function pickPreset(p: DatePreset) {
    const r = presetRange(p)
    setDraft({ ...r, preset: p })
  }

  function updateCustom(field: 'from' | 'to', value: string) {
    setDraft(prev => ({ ...prev, [field]: value, preset: 'custom' }))
  }

  function aplicar() {
    setApplied(draft)
    setExpanded(false)
  }

  function abrir() {
    setDraft(applied)   // reseta rascunho ao abrir
    setExpanded(true)
  }

  const dirty = !sameRange(draft, applied)

  const labelApplied = applied.preset === 'custom'
    ? `${fmtBR(applied.from)} → ${fmtBR(applied.to)}`
    : PRESET_LABELS[applied.preset]

  const labelDraft = draft.preset === 'custom'
    ? `${fmtBR(draft.from)} → ${fmtBR(draft.to)}`
    : PRESET_LABELS[draft.preset]

  return (
    <div className={cn('bg-surface rounded-2xl border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)]', className)}>
      <button
        onClick={() => expanded ? setExpanded(false) : abrir()}
        className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Calendar size={14} className="text-primary" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-ink/45 text-[10px] uppercase tracking-wider">Período</div>
            <div className="text-ink font-semibold text-sm truncate">{labelApplied}</div>
          </div>
        </div>
        <ChevronDown size={16} className={cn('text-ink/40 transition-transform flex-shrink-0', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-rim/40 p-3 space-y-3 animate-fade-in">
          {/* Presets */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['today','yesterday','last_7d','last_30d','this_month','last_month'] as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => pickPreset(p)}
                className={cn(
                  'px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all',
                  draft.preset === p
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-ink/5 border-rim text-ink/60 hover:bg-ink/10',
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Custom range — layout vertical pra não quebrar em mobile */}
          <div className="border-t border-rim/40 pt-3 space-y-2">
            <div className="text-ink/40 text-[10px] uppercase tracking-wider">Personalizado</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-ink/55 text-[11px] w-10 flex-shrink-0">De</label>
                <input
                  type="date"
                  value={draft.from}
                  max={draft.to}
                  onChange={e => updateCustom('from', e.target.value)}
                  className="flex-1 bg-ink/5 border border-rim rounded-lg px-2.5 py-1.5 text-ink text-[13px] focus:outline-none focus:border-primary/40 appearance-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-ink/55 text-[11px] w-10 flex-shrink-0">Até</label>
                <input
                  type="date"
                  value={draft.to}
                  min={draft.from}
                  onChange={e => updateCustom('to', e.target.value)}
                  className="flex-1 bg-ink/5 border border-rim rounded-lg px-2.5 py-1.5 text-ink text-[13px] focus:outline-none focus:border-primary/40 appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Preview rascunho + botão aplicar */}
          {dirty && (
            <div className="border-t border-rim/40 pt-2 flex items-center gap-2 text-[11px] text-ink/50">
              <span>Novo período:</span>
              <span className="text-primary font-semibold truncate">{labelDraft}</span>
            </div>
          )}

          <button
            onClick={aplicar}
            disabled={!dirty}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-semibold text-sm transition-all',
              dirty
                ? 'bg-primary text-white shadow-[0_2px_8px_rgba(0,156,59,0.3)] active:scale-95'
                : 'bg-ink/5 text-ink/30 cursor-not-allowed',
            )}
          >
            <Check size={14} />
            {dirty ? 'Aplicar e atualizar' : 'Aplicado'}
          </button>
        </div>
      )}
    </div>
  )
}
