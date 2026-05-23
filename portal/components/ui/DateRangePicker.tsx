'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface DateRange {
  from: Date | null
  to:   Date | null
}

export interface DateRangePickerProps {
  value?:    DateRange
  onChange?: (range: DateRange) => void
  className?: string
  placeholder?: string
}

// ── Utilidades ────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0,0,0,0); return r
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function fmt(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}
function fmtFull(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month+1, 0).getDate()
}
function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function addMonths(d: Date, n: number) {
  const r = new Date(d); r.setDate(1); r.setMonth(r.getMonth()+n); return r
}

// ── Atalhos de período ────────────────────────────────────────────────────────
interface Preset { label: string; range: () => DateRange }

const PRESETS: Preset[] = [
  { label: 'Hoje',         range: () => { const d=startOfDay(new Date()); return { from:d, to:d } } },
  { label: 'Ontem',        range: () => { const d=startOfDay(new Date()); d.setDate(d.getDate()-1); return { from:d, to:d } } },
  { label: 'Últimos 7d',   range: () => { const t=startOfDay(new Date()); const f=startOfDay(new Date()); f.setDate(f.getDate()-6); return { from:f, to:t } } },
  { label: 'Últimos 30d',  range: () => { const t=startOfDay(new Date()); const f=startOfDay(new Date()); f.setDate(f.getDate()-29); return { from:f, to:t } } },
  { label: 'Este mês',     range: () => { const n=new Date(); const f=new Date(n.getFullYear(),n.getMonth(),1); const t=new Date(n.getFullYear(),n.getMonth()+1,0); return { from:startOfDay(f), to:startOfDay(t) } } },
  { label: 'Mês anterior', range: () => { const n=new Date(); const f=new Date(n.getFullYear(),n.getMonth()-1,1); const t=new Date(n.getFullYear(),n.getMonth(),0); return { from:startOfDay(f), to:startOfDay(t) } } },
]

// ── Mini-calendário ───────────────────────────────────────────────────────────
interface MonthCalProps {
  year:    number
  month:   number
  from:    Date | null
  to:      Date | null
  hover:   Date | null
  onDay:   (d: Date) => void
  onHover: (d: Date | null) => void
}

function MonthCal({ year, month, from, to, hover, onDay, onHover }: MonthCalProps) {
  const days = getDaysInMonth(year, month)
  const offset = getFirstWeekday(year, month)
  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => startOfDay(new Date(year, month, i+1))),
  ]

  function isSelected(d: Date) { return (from && sameDay(d, from)) || (to && sameDay(d, to)) || false }
  function isInRange(d: Date) {
    const end = to ?? hover
    if (!from || !end) return false
    const lo = from <= end ? from : end
    const hi = from <= end ? end   : from
    return d > lo && d < hi
  }
  function isStart(d: Date) { return !!from && sameDay(d, from) }
  function isEnd(d: Date)   { return !!to   && sameDay(d, to)   }
  function isToday(d: Date) { return sameDay(d, new Date()) }

  return (
    <div className="select-none">
      <p className="text-center text-xs font-semibold text-white/70 mb-3">
        {MESES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-[10px] text-center text-white/30 font-medium pb-1">{d}</div>
        ))}
        {cells.map((d, i) =>
          d === null ? <div key={`e-${i}`} /> : (
            <button
              key={d.toISOString()}
              onClick={() => onDay(d)}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'relative h-7 w-full text-xs font-medium transition-all duration-75',
                'focus:outline-none',
                // range background
                isInRange(d) && 'bg-[#009c3b]/15',
                // start cap
                isStart(d) && to && 'rounded-l-full bg-[#009c3b]/15',
                // end cap
                isEnd(d) && from && 'rounded-r-full bg-[#009c3b]/15',
                // selected dot
                isSelected(d)
                  ? 'text-white'
                  : isToday(d)
                    ? 'text-[#009c3b]'
                    : 'text-white/70 hover:text-white',
              )}
            >
              {/* selected circle */}
              {isSelected(d) && (
                <span className="absolute inset-0 m-auto w-7 h-7 bg-[#009c3b] rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {d.getDate()}
                </span>
              )}
              {/* today ring */}
              {isToday(d) && !isSelected(d) && (
                <span className="absolute inset-0 m-auto w-7 h-7 rounded-full border border-[#009c3b]/40" />
              )}
              <span className={cn('relative z-10', isSelected(d) && 'invisible')}>
                {d.getDate()}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Selecionar período',
}: DateRangePickerProps) {
  const [open, setOpen]   = useState(false)
  const [from, setFrom]   = useState<Date | null>(value?.from ?? null)
  const [to, setTo]       = useState<Date | null>(value?.to ?? null)
  const [hover, setHover] = useState<Date | null>(null)
  const [picking, setPicking] = useState<'from' | 'to'>('from')

  // Calendário: dois meses side-by-side
  const today = new Date()
  const [leftMonth, setLeftMonth] = useState({ year: today.getFullYear(), month: today.getMonth() - 1 < 0 ? 11 : today.getMonth() - 1 })
  const [rightMonth, setRightMonth] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const ref = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sincronizar com valor externo
  useEffect(() => {
    if (value) { setFrom(value.from); setTo(value.to) }
  }, [value])

  // Avançar/recuar meses (mantém left < right)
  function prevMonth() {
    const prev = addMonths(new Date(leftMonth.year, leftMonth.month), -1)
    setLeftMonth({ year: prev.getFullYear(), month: prev.getMonth() })
    setRightMonth({ year: leftMonth.year, month: leftMonth.month })
  }
  function nextMonth() {
    const next = addMonths(new Date(rightMonth.year, rightMonth.month), 1)
    setLeftMonth({ year: rightMonth.year, month: rightMonth.month })
    setRightMonth({ year: next.getFullYear(), month: next.getMonth() })
  }

  // Clique em dia
  const handleDay = useCallback((d: Date) => {
    if (picking === 'from' || (from && to)) {
      setFrom(d); setTo(null); setPicking('to')
    } else {
      // picking 'to'
      if (from && d < from) { setTo(from); setFrom(d) }
      else setTo(d)
      setPicking('from')
    }
  }, [picking, from, to])

  // Aplicar seleção
  function apply() {
    if (from) {
      const range: DateRange = { from, to: to ?? from }
      onChange?.(range)
      setOpen(false)
    }
  }

  // Limpar
  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setFrom(null); setTo(null); setPicking('from')
    onChange?.({ from: null, to: null })
  }

  // Preset
  function applyPreset(preset: Preset) {
    const r = preset.range()
    setFrom(r.from); setTo(r.to)
    onChange?.(r)
    setOpen(false)
  }

  // Label do botão
  function label() {
    if (!from && !to) return null
    if (from && to && sameDay(from, to)) return fmtFull(from)
    if (from && to) return `${fmt(from)} → ${fmt(to)}`
    if (from) return `A partir de ${fmt(from)}`
    return null
  }

  const displayLabel = label()

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
          'border',
          open || displayLabel
            ? 'bg-[#009c3b]/10 border-[#009c3b]/30 text-[#009c3b]'
            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/8',
        )}
      >
        <Calendar size={14} />
        <span>{displayLabel ?? placeholder}</span>
        {displayLabel && (
          <span
            onClick={clear}
            className="ml-1 p-0.5 rounded hover:bg-white/10 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-2 z-50',
          'bg-[#141414] border border-white/10 rounded-xl shadow-2xl shadow-black/60',
          'flex',
        )}>
          {/* Coluna de atalhos */}
          <div className="w-36 border-r border-white/8 p-3 flex flex-col gap-0.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2 px-2">Atalhos</p>
            {PRESETS.map(p => {
              const r = p.range()
              const active = from && to
                && r.from && r.to
                && sameDay(from, r.from)
                && sameDay(to, r.to)
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'w-full text-left text-xs px-2 py-1.5 rounded-md transition-all',
                    active
                      ? 'bg-[#009c3b]/20 text-[#009c3b] font-medium'
                      : 'text-white/60 hover:text-white hover:bg-white/6',
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendários */}
          <div className="p-4">
            {/* Navegação */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-md hover:bg-white/8 text-white/40 hover:text-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-12">
                <span className="w-44" />
                <span className="w-44" />
              </div>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-md hover:bg-white/8 text-white/40 hover:text-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex gap-8">
              <div className="w-44">
                <MonthCal
                  year={leftMonth.year}
                  month={leftMonth.month}
                  from={from} to={to} hover={hover}
                  onDay={handleDay}
                  onHover={setHover}
                />
              </div>
              <div className="w-44">
                <MonthCal
                  year={rightMonth.year}
                  month={rightMonth.month}
                  from={from} to={to} hover={hover}
                  onDay={handleDay}
                  onHover={setHover}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
              <div className="text-xs text-white/30">
                {from && to
                  ? <span><span className="text-white/60">{fmtFull(from)}</span> → <span className="text-white/60">{fmtFull(to)}</span></span>
                  : from
                    ? <span>Selecione a data final</span>
                    : <span>Selecione a data inicial</span>
                }
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-lg text-white/50 hover:text-white hover:bg-white/8 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={apply}
                  disabled={!from}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg font-medium transition-all',
                    from
                      ? 'bg-[#009c3b] hover:bg-[#00872f] text-white'
                      : 'bg-white/5 text-white/25 cursor-not-allowed',
                  )}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
