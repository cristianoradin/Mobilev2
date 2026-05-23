'use client'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Plus, PanelsTopLeft, Edit2, Trash2, Play, BarChart3, LineChart,
  PieChart, Gauge, TrendingUp, TableProperties, Flame, Layers, MousePointerClick } from 'lucide-react'
import type { Dashboard } from '@/lib/types'

const ICON_MAP: Record<string, React.ElementType> = {
  line: LineChart, bar: BarChart3, pie: PieChart, gauge: Gauge,
  area: TrendingUp, report: TableProperties, kpi: Flame,
  heatmap: Layers, waterfall: BarChart3, button: MousePointerClick,
}

const MOCK_DASHBOARDS: Dashboard[] = [
  {
    id: 'dash-001',
    nome: 'Operacional do Dia',
    descricao: 'KPIs, abastecimentos e nível dos tanques em tempo real',
    cor: '#009c3b',
    widgets: [
      { id: 'w1', template_id: 'tmpl-006', size: '3', order: 0 },
      { id: 'w2', template_id: 'tmpl-001', size: '2', order: 1 },
      { id: 'w3', template_id: 'tmpl-002', size: '1', order: 2 },
      { id: 'w4', template_id: 'tmpl-009', size: '1', order: 3 },
    ],
    created_at: '2026-05-20T10:00:00Z',
  },
  {
    id: 'dash-002',
    nome: 'Financeiro Mensal',
    descricao: 'Faturamento, margens e demonstrativo de resultado',
    cor: '#3b82f6',
    widgets: [
      { id: 'w5', template_id: 'tmpl-004', size: '2', order: 0 },
      { id: 'w6', template_id: 'tmpl-008', size: '1', order: 1 },
      { id: 'w7', template_id: 'tmpl-005', size: '3', order: 2 },
    ],
    created_at: '2026-05-21T14:00:00Z',
  },
  {
    id: 'dash-003',
    nome: 'Análise de Vendas',
    descricao: 'Mix de combustíveis, heatmap de movimento e relatório detalhado',
    cor: '#f97316',
    widgets: [
      { id: 'w8',  template_id: 'tmpl-003', size: '1', order: 0 },
      { id: 'w9',  template_id: 'tmpl-007', size: '2', order: 1 },
      { id: 'w10', template_id: 'tmpl-005', size: '3', order: 2 },
    ],
    created_at: '2026-05-22T08:00:00Z',
  },
]

// Mapa de templates para buscar nome/tipo por id
const TEMPLATE_INFO: Record<string, { nome: string; chart_type: string }> = {
  'tmpl-001': { nome: 'Vendas por Hora',            chart_type: 'area'      },
  'tmpl-002': { nome: 'Nível dos Tanques',           chart_type: 'gauge'     },
  'tmpl-003': { nome: 'Mix de Combustível',          chart_type: 'pie'       },
  'tmpl-004': { nome: 'Faturamento Mensal',          chart_type: 'bar'       },
  'tmpl-005': { nome: 'Relatório de Vendas',         chart_type: 'report'    },
  'tmpl-006': { nome: 'KPI — Indicadores do Dia',   chart_type: 'kpi'       },
  'tmpl-007': { nome: 'Heatmap — Movimento',         chart_type: 'heatmap'   },
  'tmpl-008': { nome: 'Waterfall — Resultado',       chart_type: 'waterfall' },
  'tmpl-009': { nome: 'Botões — Ações Rápidas',      chart_type: 'button'    },
}

export default function DashboardsPage() {
  return (
    <div>
      <TopBar
        title="Dashboards"
        subtitle={`${MOCK_DASHBOARDS.length} dashboards configurados`}
        actions={
          <Link href="/dashboards/novo">
            <Button size="sm"><Plus size={14} />Novo Dashboard</Button>
          </Link>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-5">
          {MOCK_DASHBOARDS.map(dash => (
            <Card key={dash.id}>
              <CardBody>
                <div className="flex items-start gap-5">
                  {/* Ícone colorido */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={{
                      backgroundColor: (dash.cor ?? '#009c3b') + '18',
                      borderColor:     (dash.cor ?? '#009c3b') + '35',
                    }}
                  >
                    <PanelsTopLeft size={22} style={{ color: dash.cor ?? '#009c3b' }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold text-sm">{dash.nome}</h3>
                      <Badge variant="default">{dash.widgets.length} widgets</Badge>
                    </div>
                    <p className="text-white/40 text-xs mb-4">{dash.descricao}</p>

                    {/* Preview dos widgets */}
                    <div className="grid grid-cols-3 gap-2">
                      {dash.widgets
                        .sort((a, b) => a.order - b.order)
                        .map(w => {
                          const info = TEMPLATE_INFO[w.template_id]
                          const Icon = info ? (ICON_MAP[info.chart_type] ?? BarChart3) : BarChart3
                          const colSpan = w.size === '3' ? 'col-span-3' : w.size === '2' ? 'col-span-2' : 'col-span-1'
                          return (
                            <div
                              key={w.id}
                              className={`${colSpan} flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2`}
                            >
                              <Icon size={12} className="text-white/40 flex-shrink-0" />
                              <span className="text-white/60 text-xs truncate">
                                {info?.nome ?? w.template_id}
                              </span>
                              <span className="ml-auto text-[10px] text-white/25 flex-shrink-0">
                                {w.size === '3' ? 'full' : w.size === '2' ? '2/3' : '1/3'}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link href={`/dashboards/${dash.id}`}>
                      <Button size="sm" variant="primary">
                        <Play size={12} />Ver
                      </Button>
                    </Link>
                    <Link href={`/dashboards/${dash.id}/editar`}>
                      <Button size="sm" variant="secondary">
                        <Edit2 size={12} />Editar
                      </Button>
                    </Link>
                    <Button size="sm" variant="danger" className="w-full justify-center">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
