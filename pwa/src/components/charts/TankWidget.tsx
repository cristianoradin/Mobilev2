import type { ChartMetadata } from '@/lib/contracts'

// ─── Mock data (exibido quando MQTT não retorna dados) ────────────────────────
const MOCK_TANKS = [
  { produto: 'Gasolina Comum',     volume: 12750, capacidade: 15000, pct: 85.0 },
  { produto: 'Gasolina Aditivada', volume: 6500,  capacidade: 10000, pct: 65.0 },
  { produto: 'Etanol',             volume: 2400,  capacidade: 12000, pct: 20.0 },
  { produto: 'Diesel S10',         volume: 3040,  capacidade: 8000,  pct: 38.0 },
]

function fmtVol(v: number, unit = 'L') {
  return v.toLocaleString('pt-BR') + ' ' + unit
}

// ─── SVG cilíndrico 3D ────────────────────────────────────────────────────────
function TankSvg({ pct, color, id, fsBadge = 11.5 }: { pct: number; color: string; id: string; fsBadge?: number }) {
  const W = 80, H = 132
  const px = 6
  const capRy = 11

  const bx = px
  const by = capRy
  const bw = W - px * 2
  const bh = H - capRy * 2
  const cx = W / 2
  const rx = bw / 2

  const safe = Math.max(3, Math.min(pct, 97))
  const fh   = (safe / 100) * bh
  const fy   = by + bh - fh

  const gId  = `fg-${id}`
  const bgId = `bg-${id}`
  const clId = `cl-${id}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
          <stop offset="28%"  stopColor={color} stopOpacity="1.00" />
          <stop offset="72%"  stopColor={color} stopOpacity="1.00" />
          <stop offset="100%" stopColor={color} stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.50" />
          <stop offset="18%"  stopColor="#000" stopOpacity="0.00" />
          <stop offset="82%"  stopColor="#000" stopOpacity="0.00" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.40" />
        </linearGradient>
        <clipPath id={clId}>
          <rect x={bx} y={by} width={bw} height={bh} />
        </clipPath>
      </defs>

      {/* Corpo */}
      <rect x={bx} y={by} width={bw} height={bh} fill="#0d0d0d" />

      {/* Líquido */}
      <g clipPath={`url(#${clId})`}>
        <rect x={bx} y={fy} width={bw} height={fh} fill={`url(#${gId})`} />
        <rect
          x={bx + 3} y={fy + 3}
          width={bw - 6} height={Math.max(0, fh - 6)}
          fill={color} fillOpacity="0.10"
        />
        <ellipse cx={cx} cy={fy} rx={rx} ry={capRy * 0.62} fill={color} fillOpacity="0.93" />
        <ellipse
          cx={cx - rx * 0.22} cy={fy - capRy * 0.16}
          rx={rx * 0.30}      ry={capRy * 0.20}
          fill="white" fillOpacity="0.14"
        />
      </g>

      {/* Overlay sombra lateral */}
      <rect x={bx} y={by} width={bw} height={bh} fill={`url(#${bgId})`} clipPath={`url(#${clId})`} />

      {/* Tampa inferior */}
      <ellipse cx={cx} cy={by + bh} rx={rx} ry={capRy} fill="#080808" />

      {/* Tampa superior */}
      <ellipse cx={cx} cy={by} rx={rx}        ry={capRy}        fill="#1c1c1c" />
      <ellipse cx={cx} cy={by} rx={rx * 0.82} ry={capRy * 0.72} fill="#242424" />
      <ellipse cx={cx} cy={by - 1} rx={rx * 0.72} ry={capRy * 0.54}
               fill="none" stroke="#3a3a3a" strokeWidth="0.9" />
      <ellipse cx={cx} cy={by} rx={rx * 0.13} ry={capRy * 0.33} fill="#1a1a1a" />

      {/* Marcadores */}
      <line x1={bx - 1} y1={by + bh * 0.25} x2={bx + 5} y2={by + bh * 0.25}
            stroke="#444" strokeWidth="1" />
      <text x={bx - 3} y={by + bh * 0.25 + 3}
            textAnchor="end" fill="#555" fontSize="6.5" fontFamily="system-ui,sans-serif">75%</text>

      <line x1={bx - 1} y1={by + bh * 0.75} x2={bx + 5} y2={by + bh * 0.75}
            stroke="#444" strokeWidth="1" />
      <text x={bx - 3} y={by + bh * 0.75 + 3}
            textAnchor="end" fill="#555" fontSize="6.5" fontFamily="system-ui,sans-serif">25%</text>

      {/* Badge % */}
      {fh > 22 && (
        <>
          <rect x={cx - 20} y={fy + fh / 2 - 11} width={40} height={22} rx={5}
                fill={color} fillOpacity="0.96" />
          <text x={cx} y={fy + fh / 2 + fsBadge * 0.39} textAnchor="middle"
                fill="white" fontSize={fsBadge} fontWeight="bold" fontFamily="system-ui,sans-serif">
            {pct.toFixed(1)}%
          </text>
        </>
      )}
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface TankRow {
  produto:    string
  volume:     number
  capacidade: number
  pct:        number
}

interface Props {
  metadata: ChartMetadata
  data:     Record<string, unknown>[] | null
  loading?: boolean
}

export function TankWidget({ metadata, data, loading = false }: Props) {
  const cfg   = metadata.tank_config
  const tLow  = cfg?.threshold_low  ?? 25
  const tMid  = cfg?.threshold_mid  ?? 50
  const unit  = cfg?.unidade        ?? 'L'
  const cols  = cfg?.colunas        ?? 2
  const fProd = cfg?.field_produto    ?? 'produto'
  const fVol  = cfg?.field_volume     ?? 'volume'
  const fCap  = cfg?.field_capacidade ?? 'capacidade'
  const fPct  = cfg?.field_percentual

  const fsProduto    = cfg?.font_size_produto    ?? 12
  const fsVolume     = cfg?.font_size_volume     ?? 20
  const fsPercentual = cfg?.font_size_percentual ?? 11.5

  // Monta lista de tanques a partir dos dados MQTT ou usa mock
  const tanks: TankRow[] = (data && data.length > 0)
    ? data.map(row => {
        const vol = Number(row[fVol] ?? 0)
        const cap = Number(row[fCap] ?? 1)
        const pct = fPct
          ? Number(row[fPct] ?? 0)
          : cap > 0 ? Math.round((vol / cap) * 1000) / 10 : 0
        return {
          produto:    String(row[fProd] ?? ''),
          volume:     vol,
          capacidade: cap,
          pct,
        }
      })
    : MOCK_TANKS

  function getColor(pct: number, produto: string) {
    const override = cfg?.product_colors?.find(
      pc => pc.produto.toLowerCase() === produto.toLowerCase()
    )
    if (override) return override.color
    if (pct < tLow) return '#ef4444'
    if (pct < tMid) return '#eab308'
    return '#009c3b'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-ink/40">Carregando tanques...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tanks.map((t, i) => {
          const color = getColor(t.pct, t.produto)
          const disp  = t.capacidade - t.volume
          return (
            <div
              key={i}
              className="bg-[#0d0d0d] rounded-2xl border border-white/5 flex items-center gap-3 px-3 py-3 overflow-hidden"
            >
              {/* SVG tanque */}
              <div className="flex-shrink-0 ml-3">
                <TankSvg pct={t.pct} color={color} id={`pwa-${i}`} fsBadge={fsPercentual} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1 truncate" style={{ color: 'rgba(255,255,255,0.5)', fontSize: fsProduto }}>{t.produto}</p>

                {/* Volume — número grande colorido */}
                <p className="font-bold tracking-tight mb-2" style={{ color, fontSize: fsVolume }}>
                  {fmtVol(t.volume, unit)}
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-white/35 text-[10px]">Capacidade</span>
                    <span className="text-white/65 text-[10px] font-semibold tabular-nums">{fmtVol(t.capacidade, unit)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-white/35 text-[10px]">Disponível</span>
                    <span className="text-white/65 text-[10px] font-semibold tabular-nums">{fmtVol(disp, unit)}</span>
                  </div>
                  {/* Barra de progresso */}
                  <div className="mt-1.5 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(t.pct, 100)}%`, backgroundColor: color, opacity: 0.85 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Aviso de dados simulados */}
      {(!data || data.length === 0) && (
        <p className="text-center text-white/20 text-xs py-1">dados simulados — aguardando agente</p>
      )}
    </div>
  )
}
