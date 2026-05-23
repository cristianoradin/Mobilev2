import { RefreshCw, AlertTriangle } from 'lucide-react'
import { DynamicChart } from '@/components/charts/DynamicChart'
import { Card }   from '@/components/ui/Card'
import { Badge }  from '@/components/ui/Badge'
import { useChartData } from '@/hooks/useChartData'
import type { ChartMetadata } from '@/lib/contracts'

const metadataTanques: ChartMetadata = {
  id: 'estoque-tanques', nome: 'Nível dos Tanques', chart_type: 'gauge',
  query: { sql: '', refresh_seconds: 60, timeout_seconds: 15 },
  axes: { x: { field: 'nome', label: 'Tanque' }, y: [{ field: 'nivel', label: '%' }] },
  display: { height: 'sm', show_legend: false, show_tooltip: false },
  permissions: { min_role: 'operador' },
}

const mockTanques = [
  { id: 1, nome: 'Gasolina Comum',     nivel: 72, capacidade: 15000, litros: 10800, cor: '#009c3b' },
  { id: 2, nome: 'Gasolina Aditivada', nivel: 45, capacidade: 10000, litros: 4500,  cor: '#fbbf24' },
  { id: 3, nome: 'Etanol',             nivel: 88, capacidade: 12000, litros: 10560, cor: '#3b82f6' },
  { id: 4, nome: 'Diesel S10',         nivel: 18, capacidade: 20000, litros: 3600,  cor: '#ef4444' },
]

type Tanque = { id: number; nome: string; nivel: number; capacidade: number; litros: number; cor: string }

function buildGaugeMeta(t: Tanque): ChartMetadata {
  return { ...metadataTanques, id: `gauge-${t.id}`, axes: { x: { field: 'nome', label: t.nome }, y: [{ field: 'nivel', label: '%', color: t.cor }] } }
}

function getNivelStatus(nivel: number): { variant: 'success' | 'warning' | 'danger'; label: string } {
  if (nivel > 50) return { variant: 'success', label: 'Normal'  }
  if (nivel > 20) return { variant: 'warning', label: 'Atenção' }
  return          { variant: 'danger',  label: 'Crítico' }
}

function corParaNivel(nivel: number) {
  if (nivel > 50) return '#009c3b'
  if (nivel > 20) return '#fbbf24'
  return '#ef4444'
}

export function EstoqueScreen() {
  const { data, loading, refresh } = useChartData(metadataTanques)

  const tanques: Tanque[] = data && data.length > 0
    ? data.map((r, i) => ({
        id:         i + 1,
        nome:       String(r.nome ?? r.tanque ?? `Tanque ${i + 1}`),
        nivel:      Number(r.nivel ?? r.percentual ?? 0),
        capacidade: Number(r.capacidade ?? 10000),
        litros:     Number(r.litros ?? r.volume ?? 0),
        cor:        corParaNivel(Number(r.nivel ?? 0)),
      }))
    : mockTanques

  const criticos = tanques.filter(t => t.nivel <= 20)

  return (
    <div className="pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Estoque</h1>
          <p className="text-ink/40 text-sm">Nível dos tanques</p>
        </div>
        <button
          onClick={() => refresh(true)}
          className="p-2.5 bg-surface border border-rim rounded-xl transition-all active:scale-90"
        >
          <RefreshCw size={16} className={`text-ink/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alerta de críticos */}
      {criticos.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-danger font-semibold text-sm">Nível Crítico</p>
            <p className="text-ink/60 text-xs mt-0.5">
              {criticos.map(t => t.nome).join(', ')} abaixo de 20%
            </p>
          </div>
        </div>
      )}

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-3">
        {tanques.map(t => {
          const status = getNivelStatus(t.nivel)
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-ink/70 text-xs font-medium truncate pr-1">{t.nome}</p>
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
              </div>
              <DynamicChart metadata={buildGaugeMeta(t)} data={[{ nome: t.nome, nivel: t.nivel }]} loading={loading} />
              <p className="text-ink/40 text-xs text-center mt-2">
                {t.litros.toLocaleString('pt-BR')} / {t.capacidade.toLocaleString('pt-BR')} L
              </p>
            </Card>
          )
        })}
      </div>

      {/* Tabela resumo */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-rim">
          <h2 className="text-sm font-semibold text-ink">Resumo dos Tanques</h2>
        </div>
        <div className="divide-y divide-rim">
          {tanques.map(t => (
            <div key={t.id} className="flex items-center px-4 py-3 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-ink text-sm font-medium truncate">{t.nome}</p>
                <p className="text-ink/40 text-xs">{t.litros.toLocaleString('pt-BR')} litros</p>
              </div>
              <div className="w-20 bg-rim rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${t.nivel}%`, backgroundColor: t.cor }} />
              </div>
              <span className="text-ink font-semibold text-sm w-10 text-right">{t.nivel}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
