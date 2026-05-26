/**
 * ChartLoading — skeleton animado pra placeholder de gráfico.
 * Shimmer effect via gradient animado + variantes por tipo.
 */
import { cn } from '@/lib/cn'

type Variant = 'chart' | 'kpi' | 'table' | 'tank' | 'multiblock'

interface Props {
  variant?: Variant
  className?: string
}

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('relative overflow-hidden bg-ink/5 rounded-lg', className)}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
    </div>
  )
}

function ChartSkeleton() {
  // Barras de alturas variadas — parece um gráfico real
  const heights = ['45%', '70%', '55%', '85%', '40%', '95%', '60%', '75%', '50%', '88%']
  return (
    <div className="bg-surface rounded-2xl border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-3 w-16" />
      </div>
      <div className="flex items-end justify-between gap-2 h-48">
        {heights.map((h, i) => (
          <Shimmer key={i} className="flex-1 rounded-t" style={{ height: h, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        {[1,2,3].map(i => (
          <div key={i} className="flex items-center gap-1.5">
            <Shimmer className="w-2 h-2 rounded-full" />
            <Shimmer className="h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="bg-surface rounded-2xl border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 space-y-2">
          <Shimmer className="h-2.5 w-2/3" style={{ animationDelay: `${i * 100}ms` }} />
          <Shimmer className="h-7 w-1/2" style={{ animationDelay: `${i * 100 + 50}ms` }} />
          <Shimmer className="h-2 w-1/3" style={{ animationDelay: `${i * 100 + 100}ms` }} />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-rim/40 bg-surface2/40">
        {[0,1,2,3].map(i => <Shimmer key={i} className="h-3 flex-1" style={{ animationDelay: `${i * 60}ms` }} />)}
      </div>
      {[0,1,2,3,4,5].map(r => (
        <div key={r} className="flex items-center gap-3 px-3 py-3 border-b border-rim/30 last:border-0">
          {[0,1,2,3].map(c => (
            <Shimmer key={c} className="h-3 flex-1" style={{ animationDelay: `${(r * 4 + c) * 40}ms` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function TankSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="bg-surface rounded-2xl border border-rim/40 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 flex flex-col items-center gap-3">
          <Shimmer className="h-3 w-2/3" style={{ animationDelay: `${i * 100}ms` }} />
          <Shimmer className="h-32 w-20 rounded-xl" style={{ animationDelay: `${i * 100 + 50}ms` }} />
          <Shimmer className="h-4 w-1/2" style={{ animationDelay: `${i * 100 + 100}ms` }} />
        </div>
      ))}
    </div>
  )
}

function MultiblockSkeleton() {
  return (
    <div className="space-y-3">
      <KpiSkeleton />
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  )
}

export function ChartLoading({ variant = 'chart', className }: Props) {
  return (
    <div className={cn('animate-fade-in', className)}>
      {variant === 'chart'      && <ChartSkeleton />}
      {variant === 'kpi'        && <KpiSkeleton />}
      {variant === 'table'      && <TableSkeleton />}
      {variant === 'tank'       && <TankSkeleton />}
      {variant === 'multiblock' && <MultiblockSkeleton />}
    </div>
  )
}
