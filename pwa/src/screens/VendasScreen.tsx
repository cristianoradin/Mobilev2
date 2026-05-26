import { useState } from 'react'
import { RefreshCw, WifiOff, Clock, BarChart3 } from 'lucide-react'
import { DynamicChart } from '@/components/charts/DynamicChart'
import { Card }         from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
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


function CacheTag({ cached, stale, lastUpdate }: { cached: boolean; stale: boolean; lastUpdate: Date | null }) {
  if (!lastUpdate) return null
  const label = stale ? 'desatualizado' : cached ? 'cache' : 'ao vivo'
  const color  = stale ? 'text-yellow' : cached ? 'text-ink/30' : 'text-primary'
  return (
    <span className={`flex items-center gap-1 text-[10px] ${color}`}>
      <Clock size={10} />
      {label} · {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

export function VendasScreen() {
  const [periodo, setPeriodo] = useState('Hoje')

  const vendas  = useChartData(metadataVendas)
  const mix     = useChartData(metadataMix)
  const kpiData = useChartData(metadataKpis)

  const vendasData = vendas.data ?? []
  const mixData    = mix.data   ?? []

  const kpis = (kpiData.data && kpiData.data.length > 0)
    ? kpiData.data.map(r => ({
        label: String(r.label),
        valor: Number(r.valor),
        delta: Number(r.delta ?? 0),
        up:    Number(r.delta ?? 0) >= 0,
      }))
    : []

  const anyLoading = vendas.loading || mix.loading
  const offline    = !vendas.agentOnline && !vendas.loading

  return (
    <div className="pt-4 space-y-5">
      <ScreenHeader
        title="Vendas"
        subtitle={offline ? 'Agente offline' : 'Análise em tempo real'}
        action={
          <button
            onClick={() => { vendas.refresh(true); mix.refresh(true); kpiData.refresh(true) }}
            className="p-2.5 bg-surface rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-rim/40 transition-all active:scale-90"
          >
            <RefreshCw size={16} className={`text-ink/60 ${anyLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {/* Agente offline — sem dados */}
      {offline && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 bg-surface border border-rim rounded-2xl flex items-center justify-center">
            <WifiOff size={28} className="text-ink/20" />
          </div>
          <div className="text-center">
            <p className="text-ink/50 text-sm font-medium">Agente não conectado</p>
            <p className="text-ink/25 text-xs mt-1 max-w-xs">
              Instale o agente no computador do posto para visualizar dados de vendas em tempo real.
            </p>
          </div>
        </div>
      )}

      {/* Conteúdo real — só quando agente online */}
      {!offline && (
        <>
          {/* Filtro de período */}
          <div className="flex gap-2">
            {PERIODO_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  periodo === p
                    ? 'bg-primary text-white'
                    : 'bg-surface text-ink/50 border border-rim'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* KPIs */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {kpis.map(({ label, valor }) => (
                <Card key={label} className="p-4">
                  <p className="text-ink/50 text-xs mb-1">{label}</p>
                  <p className="text-xl font-bold text-ink">
                    {label.includes('Total do Dia') || label.includes('Ticket')
                      ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      : label.includes('Litros')
                      ? `${valor.toLocaleString('pt-BR')} L`
                      : valor
                    }
                  </p>
                </Card>
              ))}
            </div>
          )}

          {/* Sem dados ainda */}
          {!anyLoading && vendasData.length === 0 && kpis.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <BarChart3 size={28} className="text-ink/15" />
              <p className="text-ink/30 text-sm">Sem dados de vendas disponíveis</p>
            </div>
          )}

          {/* Gráfico área — vendas por hora */}
          {vendasData.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-ink">Vendas por Hora (R$)</h2>
                <CacheTag cached={vendas.cached} stale={vendas.stale} lastUpdate={vendas.lastUpdate} />
              </div>
              <DynamicChart metadata={metadataVendas} data={vendasData} loading={vendas.loading} />
            </Card>
          )}

          {/* Gráfico pizza — mix */}
          {mixData.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-ink">Mix de Combustível (%)</h2>
                <CacheTag cached={mix.cached} stale={mix.stale} lastUpdate={mix.lastUpdate} />
              </div>
              <DynamicChart metadata={metadataMix} data={mixData} loading={mix.loading} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
