import { MapPin } from 'lucide-react'
import { useWeather } from '@/hooks/useWeather'

/**
 * WeatherInline — temp + cidade alinhado à direita na saudação.
 * Silencioso em erros (clima é decorativo).
 */
export function WeatherInline() {
  const { data, loading, error } = useWeather()

  if (error || (!data && !loading)) return null
  if (loading && !data) {
    return (
      <div className="flex flex-col items-end gap-0.5 opacity-40">
        <span className="text-[20px] font-semibold text-ink">…</span>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="flex flex-col items-end gap-1.5" title={data.desc}>
      <div className="flex items-center gap-2.5 text-[30px] font-bold text-ink leading-none">
        <span className="text-[38px] leading-none">{data.emoji}</span>
        <span>{data.temp}°</span>
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-ink/55 font-medium">
        <MapPin size={13} />
        <span className="truncate max-w-[160px]">{data.city}</span>
      </div>
    </div>
  )
}
