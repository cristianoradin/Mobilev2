/**
 * TemplateCard — card de template estilo home menu (pastel + shadow + chevron).
 * Usado em GraficosScreen e MenuCategoriaScreen.
 */
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getIcon, defaultIconForChart } from '@/lib/icons'
import type { ChartMetadata } from '@/lib/contracts'

interface Props {
  template:  ChartMetadata & { descricao?: string }
  onClick:   () => void
  className?: string
}

// Paleta default por chart_type quando user não escolheu cor própria
const DEFAULT_BG: Record<string, string> = {
  area: '#C5E8D6', line: '#C5E8D6', bar: '#C5E8D6',
  pie: '#C2DEFF', heatmap: '#DDD6FE', waterfall: '#C2DEFF',
  gauge: '#DDD6FE', report: '#FFD9B3', kpi: '#FFEAB3',
  button: '#FBCFE8', tank: '#C5E8D6', multiblock: '#DDD6FE',
}
const DEFAULT_COLOR: Record<string, string> = {
  area: '#007538', line: '#007538', bar: '#007538',
  pie: '#2D69B0', heatmap: '#5B4DBC', waterfall: '#2D69B0',
  gauge: '#5B4DBC', report: '#D66820', kpi: '#CC8F15',
  button: '#B83280', tank: '#007538', multiblock: '#5B4DBC',
}

export function TemplateCard({ template, onClick, className }: Props) {
  // Resolve ícone — user choice ou fallback por chart_type
  const userIcon = template.display?.icon
  const Icon = getIcon(userIcon) ?? defaultIconForChart(template.chart_type)

  // Cores — user choice ou default pastel
  const iconBg    = template.display?.iconBg    ?? template.display?.icon_bg    ?? DEFAULT_BG[template.chart_type]    ?? '#C5E8D6'
  const iconColor = template.display?.iconColor ?? template.display?.icon_color ?? DEFAULT_COLOR[template.chart_type] ?? '#007538'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 bg-surface rounded-2xl p-4 text-left',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]',
        'border border-transparent hover:border-rim',
        'transition-all duration-200 active:scale-[0.98]',
        className,
      )}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={26} color={iconColor} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink font-semibold text-[17px] leading-tight">{template.nome}</p>
        {template.descricao
          ? <p className="text-ink/50 text-[13px] mt-0.5 leading-tight line-clamp-1">{template.descricao}</p>
          : <p className="text-ink/40 text-[12px] mt-0.5">Toque pra abrir</p>
        }
      </div>
      <ChevronRight size={18} className="text-ink/30 flex-shrink-0" />
    </button>
  )
}
