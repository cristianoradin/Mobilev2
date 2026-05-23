import { useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, WifiOff, Clock } from 'lucide-react'
import { DynamicChart } from '@/components/charts/DynamicChart'
import { Card } from '@/components/ui/Card'
import { useChartData } from '@/hooks/useChartData'
import type { ChartMetadata } from '@/lib/contracts'

const PERIODO_OPTIONS = ['Hoje', '7 dias', '30 dias', '3 meses']

const metadataVendas: ChartMetadata = {
  id: 'vendas-hora',
  nome: 'Vendas por Hora',
  chart_type: 'area',
  query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
  axes: {
    x: { field: 'hora', label: 'Hora' },
    y: [
      { field: 'gasolina', label: 'Gasolina', color: '#009c3b' },
      { field: 'etanol',   label: 'Etanol',   color: '#3b82f6' },
      { field: 'diesel',   label: 'Diesel',   color: '#f97316' },
    ],
  },
  display: { height: 'md', show_legend: true, show_tooltip: true, gradient: true },
  permissions: { min_role: 'operador' },
}

const metadataMix: ChartMetadata = {
  id: 'vendas-mix',
  nome: 'Mix de Combustível',
  chart_type: 'pie',
  query: { sql: '', refresh_seconds: 300, timeout_seconds: 30 },
  axes: {
    x: { field: 'tipo', label: 'Tipo' },
    y: [{ field: 'valor', label: 'Participação (%)' }],
  },
  display: { height: 'sm', show_legend: true, show_tooltip: true },
  permissions: { min_role: 'operador' },
}

const metadataKpis: ChartMetadata = {
  id: 'vendas-kpis',
  nome: 'KPIs do Dia',
  chart_type: 'bar',
  query: { sql: '', refresh_seconds: 120, timeout_seconds: 15 },
  axes: { x: { field: 'label', label: '' }, y: [{ field: 'valor', label: '' }] },
  display: { height: 'sm', show_legend: false, show_tooltip: false },
  permissions: { min_role: 'operador' },
}

// Fallback mock enquanto sem agente
const mockVendas = Array.from({ length: 12 }, (_, i) => ({
  hora: `${(i * 2).toString().padStart(2, '0')}:00`,
  gasolina: Math.floor(Math.random() * 5000 + 2000),
  etanol:   Math.floor(Math.random() * 3000 + 1000),
  diesel:   Math.floor(Math.random() * 4000 + 1500),
}))
const mockMix = [
  { tipo: 'Gasolina', valor: 45.2 },
  { tipo: 'Etanol',   valor: 28.7 },
  { tipo: 'Diesel',   valor: 26.1 },
]
const mockKpis = [
  { label: 'Total do Dia', valor: 12847, delta: 8.3,  up: true  },
  { label: 'Litros Total', valor: 2341,  delta: 5.1,  up: true  },
  { label: 'Ticket Médio', valor: 158.4, delta: -2.1, up: false },
  { label: 'Abastecimentos', valor: 81,  delta: 12,   up: true  },
]

function CacheTag({ cached, stale, lastUpdate }: { cached: boolean; stale: boolean; lastUpdate: Date | null }) {
  if (!lastUpdate) return null
  const label = stale ? 'desatualizado' : cached ? 'cache' : 'ao vivo'
  const color  = stale ? 'text-yellow-400' : cached ? 'text-white/30' : 'text-primary'
  return (
    <span className={`flex items-center gap-1 text-[10px] ${color}`}>
      <Clock size={10} />
      {label} · {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function VendasScreen() {
  const [periodo, setPeriodo] = useState('Hoje')

  const vendas = useChartData(metadataVendas)
  const mix    = useChartData(metadataMix)
  const kpiData = useChartData(metadataKpis)

  // Usa dados reais do agente ou fallback mock
  const vendasData = vendas.data ?? mockVendas
  const mixData    = mix.data   ?? mockMix

  // KPIs: se vier do agente usa, senão usa mock
  const kpis = (kpiData.data && kpiData.data.length > 0)
    ? kpiData.data.map(r => ({
        label: String(r.label),
        valor: Number(r.valor),
        delta: Number(r.delta ?? 0),
        up:    Number(r.delta ?? 0) >= 0,
      }))
    : mockKpis

  const anyLoading = vendas.loading || mix.loading
  const offline    = !vendas.agentOnline && !vendas.loading && vendas.error !== null

  return (
    <div className="pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Vendas</h1>
          <p className="text-white/40 text-sm">
            {offline ? 'Agente offline — dados mock' : 'Análise em tempo real'}
          </p>
        </div>
        <button
          onClick={() => { vendas.refresh(true); mix.refresh(true); kpiData.refresh(true) }}
          className="p-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl transition-all active:scale-90"
        >
          <RefreshCw size={16} className={`text-white/60 ${anyLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Banner offline */}
      {offline && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
          <WifiOff size={14} className="text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 text-xs">Agente local não encontrado — exibindo dados demonstrativos</p>
        </div>
      )}

      {/* Filtro de período */}
      <div className="flex gap-2">
        {PERIODO_OPTIONS.map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              periodo === p
                ? 'bg-primary text-white'
                : 'bg-[#1a1a1a] text-white/50 border border-[#2a2a2a]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, valor, delta, up }) => (
          <Card key={label} className="p-4">
            <p className="text-white/50 text-xs mb-1">{label}</p>
            <p className="text-xl font-bold text-white">
              {label.includes('Total do Dia') || label.includes('Ticket')
                ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                : label.includes('Litros')
                ? `${valor.toLocaleString('pt-BR')} L`
                : valor
              }
            </p>
            <div className={`flex items-center gap-1 mt-1 ${up ? 'text-primary' : 'text-danger'}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs font-medium">
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs ontem
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Gráfico área — vendas por hora */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Vendas por Hora (R$)</h2>
          <CacheTag cached={vendas.cached} stale={vendas.stale} lastUpdate={vendas.lastUpdate} />
        </div>
        <DynamicChart metadata={metadataVendas} data={vendasData} loading={vendas.loading} />
      </Card>

      {/* Gráfico pizza — mix */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Mix de Combustível (%)</h2>
          <CacheTag cached={mix.cached} stale={mix.stale} lastUpdate={mix.lastUpdate} />
        </div>
        <DynamicChart metadata={metadataMix} data={mixData} loading={mix.loading} />
      </Card>
    </div>
  )
}
