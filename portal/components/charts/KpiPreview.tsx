'use client'
import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { cn } from '@/lib/cn'
import type { ChartMetadata, KpiMetric } from '@/lib/types'

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ color, seed = 0 }: { color: string; seed?: number }) {
  const data = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const x = Math.sin(seed * 7 + i * 1.3) * 0.5 + 0.5
      return 30 + x * 60 + i * 3
    })
  }, [seed])

  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const lastPt = pts[pts.length - 1].split(',')

  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <defs>
        <linearGradient id={`spk-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#spk-${seed})`}
        points={`0,${H} ${pts.join(' ')} ${W},${H}`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(' ')}
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={color} />
    </svg>
  )
}

// ── Formatação ────────────────────────────────────────────────────────────────
function fmtValue(v: number, fmt: string | undefined) {
  switch (fmt) {
    case 'currency': return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'percent':  return `${v.toFixed(1)}%`
    default:         return v.toLocaleString('pt-BR')
  }
}

// Valores mock determinísticos por índice
const MOCK_BASE = [8420, 42850, 87.3, 3]
const MOCK_DELTA = [7.2, 3.1, -1.4, 12.5]

// ── KPI Card individual ───────────────────────────────────────────────────────
function KpiCard({ metric, idx }: { metric: KpiMetric; idx: number }) {
  const Icon    = getIcon(metric.icon)
  const color   = metric.color ?? '#009c3b'
  const fmt     = metric.format ?? 'number'
  const mockVal = MOCK_BASE[idx % 4] * (1 + ((idx * 0.23) % 0.4))
  const delta   = MOCK_DELTA[idx % 4]
  const isUp    = delta >= 0

  return (
    <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5 flex flex-col gap-3
                    hover:border-white/[0.12] transition-colors group">
      {/* Topo: ícone + label + sparkline */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color + '18' }}
          >
            {Icon && <Icon size={16} style={{ color }} />}
          </div>
          <span className="text-white/50 text-xs font-medium leading-tight truncate">
            {metric.label}
          </span>
        </div>
        {metric.sparkline && <Sparkline color={color} seed={idx} />}
      </div>

      {/* Valor principal */}
      <p className="text-white text-[26px] font-bold tabular-nums leading-none tracking-tight">
        {fmtValue(mockVal, fmt)}
      </p>

      {/* Delta */}
      {metric.delta_field && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          isUp ? 'text-emerald-400' : 'text-red-400',
        )}>
          {isUp
            ? <TrendingUp  size={12} className="flex-shrink-0" />
            : <TrendingDown size={12} className="flex-shrink-0" />
          }
          <span>{isUp ? '+' : ''}{delta.toFixed(1)}% {metric.delta_label ?? 'vs anterior'}</span>
        </div>
      )}
    </div>
  )
}

// ── Layout grid ───────────────────────────────────────────────────────────────
const GRID_CLS: Record<string, string> = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-2',
  '4': 'grid-cols-2',
}

// ── Componente principal ──────────────────────────────────────────────────────
export function KpiPreview({ metadata }: { metadata: ChartMetadata }) {
  const cfg     = metadata.kpi_config
  const metrics = cfg?.metrics ?? []
  const layout  = cfg?.layout  ?? '4'

  return (
    <div className="h-full flex flex-col bg-[#111]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className="text-white/40 text-xs">Preview — dados mock</span>
        <span className="text-white/30 text-xs">KPI · {metrics.length} métrica{metrics.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {metrics.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/20 text-sm">
            Adicione ao menos uma métrica
          </div>
        ) : (
          <div className={cn('grid gap-3', GRID_CLS[layout] ?? 'grid-cols-2')}>
            {metrics.map((m, i) => (
              <KpiCard key={i} metric={m} idx={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
