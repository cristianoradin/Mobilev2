import { useEffect, useState } from 'react'

/**
 * useWeather — pega clima da localização do dispositivo via geolocation.
 * API: Open-Meteo (grátis, sem key, sem rate limit pra uso pessoal).
 * Cache: 30min em localStorage pra economizar requests + reverso geo (cidade).
 */
export interface WeatherData {
  temp:      number
  code:      number         // WMO weather code
  city:      string
  emoji:     string
  desc:      string
  updatedAt: number         // timestamp ms
}

const CACHE_KEY    = 'sga-weather'
const CACHE_TTL_MS = 30 * 60 * 1000   // 30 min

const WMO: Record<number, { emoji: string; desc: string }> = {
  0:  { emoji: '☀️', desc: 'Céu limpo'        },
  1:  { emoji: '🌤️', desc: 'Quase limpo'      },
  2:  { emoji: '⛅', desc: 'Parcialmente nublado' },
  3:  { emoji: '☁️', desc: 'Nublado'           },
  45: { emoji: '🌫️', desc: 'Neblina'           },
  48: { emoji: '🌫️', desc: 'Neblina gelada'    },
  51: { emoji: '🌦️', desc: 'Garoa leve'        },
  53: { emoji: '🌦️', desc: 'Garoa'             },
  55: { emoji: '🌧️', desc: 'Garoa forte'       },
  61: { emoji: '🌧️', desc: 'Chuva fraca'       },
  63: { emoji: '🌧️', desc: 'Chuva'             },
  65: { emoji: '🌧️', desc: 'Chuva forte'       },
  71: { emoji: '🌨️', desc: 'Neve fraca'        },
  73: { emoji: '🌨️', desc: 'Neve'              },
  75: { emoji: '❄️', desc: 'Neve forte'        },
  80: { emoji: '🌦️', desc: 'Pancada'           },
  81: { emoji: '🌧️', desc: 'Pancada forte'     },
  82: { emoji: '⛈️', desc: 'Tempestade'        },
  95: { emoji: '⛈️', desc: 'Trovoada'          },
  96: { emoji: '⛈️', desc: 'Trovoada+granizo'  },
  99: { emoji: '⛈️', desc: 'Trovoada forte'    },
}

function wmoMeta(code: number) {
  return WMO[code] ?? { emoji: '🌡️', desc: '—' }
}

interface CacheEntry {
  data: WeatherData
}

function readCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CacheEntry
    if (!c.data || Date.now() - c.data.updatedAt > CACHE_TTL_MS) return null
    return c.data
  } catch { return null }
}

function writeCache(data: WeatherData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data })) } catch { /* quota */ }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  // Forecast atual
  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
  )
  if (!wRes.ok) throw new Error('weather HTTP ' + wRes.status)
  const w = await wRes.json() as { current: { temperature_2m: number; weather_code: number } }
  const temp = Math.round(w.current.temperature_2m)
  const code = Number(w.current.weather_code)

  // Reverso geo — Open-Meteo tem /reverse, fallback "Sua região"
  let city = 'Sua região'
  try {
    const gRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=pt`
    )
    if (gRes.ok) {
      const g = await gRes.json() as { results?: Array<{ name?: string; admin1?: string }> }
      const r = g.results?.[0]
      if (r?.name) city = r.name
    }
  } catch { /* keep fallback */ }

  const meta = wmoMeta(code)
  return { temp, code, city, emoji: meta.emoji, desc: meta.desc, updatedAt: Date.now() }
}

export function useWeather() {
  const [data, setData]       = useState<WeatherData | null>(() => readCache())
  const [error, setError]     = useState<'denied' | 'unavailable' | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Se cache válido, não pede geo de novo
    if (data) return
    if (!('geolocation' in navigator)) { setError('unavailable'); return }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(pos.coords.latitude, pos.coords.longitude)
          .then(d => { setData(d); writeCache(d) })
          .catch(() => setError('unavailable'))
          .finally(() => setLoading(false))
      },
      err => {
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) setError('denied')
        else setError('unavailable')
      },
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data, loading, error }
}
