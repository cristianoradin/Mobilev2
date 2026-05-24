'use client'
import type { ChartMetadata } from '@/lib/types'

// ─── Dados mock para preview ──────────────────────────────────────────────────
const MOCK_TANKS = [
  { produto: 'Gasolina Comum',     volume: 12750, capacidade: 15000, pct: 85.0 },
  { produto: 'Gasolina Aditivada', volume: 6500,  capacidade: 10000, pct: 65.0 },
  { produto: 'Etanol',             volume: 2400,  capacidade: 12000, pct: 20.0 },
  { produto: 'Diesel S10',         volume: 3040,  capacidade: 8000,  pct: 38.0 },
]

function fmtVol(v: number, unit = 'L') {
  return v.toLocaleString('pt-BR') + unit
}

// ─── SVG do tanque cilíndrico ─────────────────────────────────────────────────
function TankSvg({ pct, color, id, fsBadge = 13 }: { pct: number; color: string; id: string; fsBadge?: number }) {
  const W = 90, H = 148
  const px = 7
  const capRy = 12

  const bx = px
  const by = capRy
  const bw = W - px * 2
  const bh = H - capRy * 2
  const cx = W / 2
  const rx = bw / 2

  // Limita para evitar artefatos visuais
  const safe = Math.max(3, Math.min(pct, 97))
  const fh   = (safe / 100) * bh
  const fy   = by + bh - fh

  const gId  = `fg-${id}`
  const bgId = `bg-${id}`
  const clId = `cl-${id}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        {/* Gradiente horizontal do líquido — efeito cilíndrico */}
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
          <stop offset="28%"  stopColor={color} stopOpacity="1.00" />
          <stop offset="72%"  stopColor={color} stopOpacity="1.00" />
          <stop offset="100%" stopColor={color} stopOpacity="0.38" />
        </linearGradient>

        {/* Sombra lateral do corpo do tanque */}
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.50" />
          <stop offset="18%"  stopColor="#000" stopOpacity="0.00" />
          <stop offset="82%"  stopColor="#000" stopOpacity="0.00" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.40" />
        </linearGradient>

        {/* Clip para manter o líquido dentro do corpo */}
        <clipPath id={clId}>
          <rect x={bx} y={by} width={bw} height={bh} />
        </clipPath>
      </defs>

      {/* ── Corpo (fundo escuro) ── */}
      <rect x={bx} y={by} width={bw} height={bh} fill="#0d0d0d" />

      {/* ── Líquido ── */}
      <g clipPath={`url(#${clId})`}>
        {/* Retângulo principal do líquido */}
        <rect x={bx} y={fy} width={bw} height={fh} fill={`url(#${gId})`} />

        {/* Brilho interno suave */}
        <rect
          x={bx + 4} y={fy + 4}
          width={bw - 8} height={Math.max(0, fh - 8)}
          fill={color} fillOpacity="0.10"
        />

        {/* Elipse na superfície do líquido (efeito 3D) */}
        <ellipse
          cx={cx} cy={fy}
          rx={rx} ry={capRy * 0.62}
          fill={color} fillOpacity="0.93"
        />

        {/* Reflexo na superfície */}
        <ellipse
          cx={cx - rx * 0.22} cy={fy - capRy * 0.16}
          rx={rx * 0.30}      ry={capRy * 0.20}
          fill="white" fillOpacity="0.14"
        />
      </g>

      {/* ── Overlay sombra lateral ── */}
      <rect
        x={bx} y={by} width={bw} height={bh}
        fill={`url(#${bgId})`}
        clipPath={`url(#${clId})`}
      />

      {/* ── Tampa inferior ── */}
      <ellipse cx={cx} cy={by + bh} rx={rx} ry={capRy} fill="#080808" />

      {/* ── Tampa superior ── */}
      <ellipse cx={cx} cy={by} rx={rx}        ry={capRy}        fill="#1c1c1c" />
      <ellipse cx={cx} cy={by} rx={rx * 0.82} ry={capRy * 0.72} fill="#242424" />
      <ellipse cx={cx} cy={by - 1} rx={rx * 0.72} ry={capRy * 0.54}
               fill="none" stroke="#3a3a3a" strokeWidth="0.9" />
      {/* Bocal central */}
      <ellipse cx={cx} cy={by} rx={rx * 0.13} ry={capRy * 0.33} fill="#1a1a1a" />

      {/* ── Marcadores de nível ── */}
      <line x1={bx - 1} y1={by + bh * 0.25} x2={bx + 6} y2={by + bh * 0.25}
            stroke="#444" strokeWidth="1" />
      <text x={bx - 4} y={by + bh * 0.25 + 3.5}
            textAnchor="end" fill="#555" fontSize="7" fontFamily="system-ui,sans-serif">
        75%
      </text>

      <line x1={bx - 1} y1={by + bh * 0.75} x2={bx + 6} y2={by + bh * 0.75}
            stroke="#444" strokeWidth="1" />
      <text x={bx - 4} y={by + bh * 0.75 + 3.5}
            textAnchor="end" fill="#555" fontSize="7" fontFamily="system-ui,sans-serif">
        25%
      </text>

      {/* ── Badge de percentual ── */}
      {fh > 26 && (
        <>
          <rect
            x={cx - 24} y={fy + fh / 2 - 13}
            width={48}   height={26}
            rx={6} fill={color} fillOpacity="0.96"
          />
          <text
            x={cx} y={fy + fh / 2 + fsBadge * 0.42}
            textAnchor="middle"
            fill="white" fontSize={fsBadge} fontWeight="bold"
            fontFamily="system-ui,sans-serif"
          >
            {pct.toFixed(1)}%
          </text>
        </>
      )}
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function TankPreview({ metadata }: { metadata: ChartMetadata }) {
  const cfg    = metadata.tank_config
  const tLow   = cfg?.threshold_low  ?? 25
  const tMid   = cfg?.threshold_mid  ?? 50
  const unit   = cfg?.unidade        ?? 'L'
  const cols   = cfg?.colunas        ?? 1

  const fsProduto    = cfg?.font_size_produto    ?? 12
  const fsVolume     = cfg?.font_size_volume     ?? 22
  const fsPercentual = cfg?.font_size_percentual ?? 11

  function getColor(pct: number, produto: string) {
    // Cor fixa por produto tem prioridade
    const override = cfg?.product_colors?.find(
      pc => pc.produto.toLowerCase() === produto.toLowerCase()
    )
    if (override) return override.color
    if (pct < tLow) return '#ef4444'
    if (pct < tMid) return '#eab308'
    return '#009c3b'
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0d0d0d] text-white">
      {/* ── Cabeçalho ── */}
      <div className="px-5 py-3 border-b border-white/8 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">
            {metadata.nome || 'Estoque de Combustível'}
          </p>
          <p className="text-white/30 text-xs mt-0.5">Preview com dados simulados</p>
        </div>
        <span className="text-[10px] text-white/20 bg-white/5 border border-white/8 rounded px-2 py-0.5">
          {MOCK_TANKS.length} tanques
        </span>
      </div>

      {/* ── Lista de tanques ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr',
        }}
      >
        {MOCK_TANKS.map((t, i) => {
          const color = getColor(t.pct, t.produto)
          const disp  = t.capacidade - t.volume
          const borderClass = cols === 2
            ? i % 2 === 0 ? 'border-b border-r border-white/5' : 'border-b border-white/5'
            : 'border-b border-white/5'

          return (
            <div key={i} className={`flex items-center gap-4 px-5 py-4 ${borderClass}`}>
              {/* Tanque SVG */}
              <div className="flex-shrink-0 ml-5">
                <TankSvg pct={t.pct} color={color} id={String(i)} fsBadge={fsPercentual} />
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1 truncate" style={{ color: 'rgba(255,255,255,0.5)', fontSize: fsProduto }}>{t.produto}</p>

                {/* Volume atual — número grande colorido */}
                <p className="font-bold tracking-tight mb-3" style={{ color, fontSize: fsVolume }}>
                  {fmtVol(t.volume, unit)}
                </p>

                {/* Detalhes */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/35 text-xs">Capacidade</span>
                    <span className="text-white/65 text-xs font-semibold tabular-nums">
                      {fmtVol(t.capacidade, unit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/35 text-xs">Disponível</span>
                    <span className="text-white/65 text-xs font-semibold tabular-nums">
                      {fmtVol(disp, unit)}
                    </span>
                  </div>

                  {/* Barra de progresso fina */}
                  <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${t.pct}%`, backgroundColor: color, opacity: 0.8 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
