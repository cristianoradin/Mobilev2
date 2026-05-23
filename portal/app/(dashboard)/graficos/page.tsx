'use client'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Plus, BarChart3, LineChart, PieChart, Gauge, TrendingUp, Edit2, Trash2, Copy,
  TableProperties, Flame, Layers, MousePointerClick } from 'lucide-react'
import type { ChartMetadata } from '@/lib/types'

const ICON_MAP: Record<string, React.ElementType> = {
  line:      LineChart,
  bar:       BarChart3,
  pie:       PieChart,
  gauge:     Gauge,
  area:      TrendingUp,
  report:    TableProperties,
  kpi:       Flame,
  heatmap:   Layers,
  waterfall: BarChart3,
  button:    MousePointerClick,
}

// Cor de destaque por tipo (bg/text)
const TYPE_STYLE: Record<string, { bg: string; text: string; badge: 'success'|'info'|'warning'|'purple'|'danger'|'default' }> = {
  report:    { bg: 'bg-blue-500/10    border-blue-500/20',    text: 'text-blue-400',   badge: 'info'    },
  kpi:       { bg: 'bg-amber-500/10   border-amber-500/20',   text: 'text-amber-400',  badge: 'warning' },
  heatmap:   { bg: 'bg-purple-500/10  border-purple-500/20',  text: 'text-purple-400', badge: 'purple'  },
  waterfall: { bg: 'bg-cyan-500/10    border-cyan-500/20',    text: 'text-cyan-400',   badge: 'info'    },
  button:    { bg: 'bg-rose-500/10    border-rose-500/20',    text: 'text-rose-400',   badge: 'danger'  },
}

const TYPE_LABEL: Partial<Record<string, string>> = {
  report:    'Relatório',
  kpi:       'KPI Card',
  heatmap:   'Heatmap',
  waterfall: 'Waterfall',
  button:    'Botões',
}
const COLOR_CAT: Record<string, 'success' | 'info' | 'warning' | 'purple' | 'default'> = {
  vendas: 'success', estoque: 'info', financeiro: 'warning', operacional: 'purple', geral: 'default',
}

const MOCK_TEMPLATES: ChartMetadata[] = [
  {
    id: 'tmpl-001', nome: 'Vendas por Hora', descricao: 'Volume de vendas agrupado por hora do dia',
    categoria: 'vendas', chart_type: 'area', is_publico: true,
    query: { sql: 'SELECT hora, total FROM vendas WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'hora', label: 'Hora' }, y: [{ field: 'total', label: 'Total R$', color: '#009c3b' }] },
    display: { height: 'md', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'operador' }, created_at: '2026-05-10T10:00:00Z',
  },
  {
    id: 'tmpl-002', nome: 'Nível dos Tanques', descricao: 'Percentual atual de combustível em cada tanque',
    categoria: 'estoque', chart_type: 'gauge', is_publico: true,
    query: { sql: 'SELECT nivel FROM tanques WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'tanque', label: 'Tanque' }, y: [{ field: 'nivel', label: '%', color: '#3b82f6' }] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' }, created_at: '2026-05-12T14:00:00Z',
  },
  {
    id: 'tmpl-003', nome: 'Mix de Combustível', descricao: 'Participação % de cada combustível nas vendas',
    categoria: 'vendas', chart_type: 'pie', is_publico: false,
    query: { sql: 'SELECT tipo, sum(litros) as litros FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY tipo', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'tipo', label: 'Tipo' }, y: [{ field: 'litros', label: 'Litros', color: '#f97316' }] },
    display: { height: 'sm', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'gerente' }, created_at: '2026-05-15T09:00:00Z',
  },
  {
    id: 'tmpl-004', nome: 'Faturamento Mensal', descricao: 'Evolução do faturamento nos últimos 30 dias',
    categoria: 'financeiro', chart_type: 'bar', is_publico: false,
    query: { sql: 'SELECT data, total FROM faturamento WHERE empresa_id IN (:empresas_filtradas) AND data >= NOW()-30', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'data', label: 'Data' }, y: [{ field: 'total', label: 'Faturamento', color: '#fbbf24' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'dono' }, created_at: '2026-05-18T16:00:00Z',
  },
  {
    id: 'tmpl-005', nome: 'Relatório de Vendas por Produto', descricao: 'Tabela detalhada de vendas agrupadas por combustível com totais',
    categoria: 'vendas', chart_type: 'report', is_publico: true,
    query: { sql: 'SELECT produto, SUM(litros) AS quantidade, SUM(total) AS total, AVG(margem)*100 AS margem, MAX(data) AS data FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY produto ORDER BY total DESC', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'produto', label: 'Produto' }, y: [{ field: 'total', label: 'Total' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
    report_config: {
      columns: [
        { field: 'produto',    label: 'Produto',       format: 'text',     align: 'left',   summary: 'none'  },
        { field: 'quantidade', label: 'Volume (L)',     format: 'number',   align: 'right',  summary: 'sum'   },
        { field: 'total',      label: 'Total (R$)',     format: 'currency', align: 'right',  summary: 'sum'   },
        { field: 'margem',     label: 'Margem %',      format: 'percent',  align: 'right',  summary: 'avg'   },
        { field: 'data',       label: 'Última Venda',  format: 'date',     align: 'center', summary: 'none'  },
      ],
      show_totals: true,
      show_index:  true,
    },
    created_at: '2026-05-20T11:00:00Z',
  },
  {
    id: 'tmpl-006', nome: 'KPI — Indicadores do Dia', descricao: '4 métricas-chave em tempo real: litros, faturamento, margem e abastecimentos',
    categoria: 'vendas', chart_type: 'kpi', is_publico: true,
    query: { sql: 'SELECT litros, faturamento, margem, abastecimentos, delta_litros, delta_fat, delta_margem, delta_abast FROM resumo_dia WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'label', label: 'Métrica' }, y: [] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
    kpi_config: {
      layout: '4',
      metrics: [
        { field: 'litros',         label: 'Litros Vendidos',  format: 'number',   delta_field: 'delta_litros',  delta_label: 'vs ontem', icon: 'Fuel',         color: '#009c3b', sparkline: true  },
        { field: 'faturamento',    label: 'Faturamento',      format: 'currency', delta_field: 'delta_fat',     delta_label: 'vs ontem', icon: 'DollarSign',   color: '#3b82f6', sparkline: true  },
        { field: 'margem',         label: 'Margem Média',     format: 'percent',  delta_field: 'delta_margem',  delta_label: 'vs ontem', icon: 'TrendingUp',   color: '#f59e0b', sparkline: false },
        { field: 'abastecimentos', label: 'Abastecimentos',   format: 'number',   delta_field: 'delta_abast',   delta_label: 'vs ontem', icon: 'ShoppingCart', color: '#8b5cf6', sparkline: false },
      ],
    },
    created_at: '2026-05-21T08:00:00Z',
  },
  {
    id: 'tmpl-007', nome: 'Heatmap — Movimento por Hora/Dia', descricao: 'Intensidade de vendas por hora do dia × dia da semana — identifica picos e vales',
    categoria: 'operacional', chart_type: 'heatmap', is_publico: false,
    query: { sql: 'SELECT EXTRACT(hour FROM created_at)/3*3 AS hora, EXTRACT(dow FROM created_at) AS dia_semana, SUM(litros) AS litros FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY hora, dia_semana', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'hora', label: 'Horário' }, y: [{ field: 'dia_semana', label: 'Dia' }, { field: 'litros', label: 'Volume (L)' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'gerente' },
    created_at: '2026-05-21T10:00:00Z',
  },
  {
    id: 'tmpl-008', nome: 'Waterfall — Demonstrativo de Resultado', descricao: 'Composição do resultado do período: faturamento → custos → impostos → margem líquida',
    categoria: 'financeiro', chart_type: 'waterfall', is_publico: false,
    query: { sql: "SELECT componente, valor FROM resultado_periodo WHERE empresa_id IN (:empresas_filtradas) ORDER BY ordem", refresh_seconds: 86400, timeout_seconds: 60 },
    axes: { x: { field: 'componente', label: 'Componente' }, y: [{ field: 'valor', label: 'Valor (R$)', color: '#009c3b' }] },
    display: { height: 'lg', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'dono' },
    created_at: '2026-05-21T12:00:00Z',
  },
  {
    id: 'tmpl-009', nome: 'Botões — Ações Rápidas do Operador', descricao: 'Atalhos de tela: estoque, troca de preço e autorizações de desconto',
    categoria: 'operacional', chart_type: 'button', is_publico: true,
    query: { sql: '', refresh_seconds: 0, timeout_seconds: 0 },
    axes: { x: { field: '', label: '' }, y: [] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
    button_config: {
      layout: 'horizontal',
      buttons: [
        { icon: 'Fuel',          label: 'Estoque de Tanques', variant: 'primary',   size: 'md', action: { type: 'navigate', route: '/estoque'      } },
        { icon: 'DollarSign',    label: 'Trocar Preço',       variant: 'secondary', size: 'md', action: { type: 'navigate', route: '/troca-preco'  } },
        { icon: 'AlertTriangle', label: 'Autorizações',       variant: 'danger',    size: 'md', action: { type: 'navigate', route: '/autorizacoes' } },
      ],
    },
    created_at: '2026-05-21T14:00:00Z',
  },
]

export default function GraficosPage() {
  return (
    <div>
      <TopBar
        title="Templates de Gráficos"
        subtitle={`${MOCK_TEMPLATES.length} templates`}
        actions={
          <Link href="/graficos/novo">
            <Button size="sm"><Plus size={14} />Novo Template</Button>
          </Link>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-2 gap-5">
          {MOCK_TEMPLATES.map(tmpl => {
            const Icon    = ICON_MAP[tmpl.chart_type] ?? BarChart3
            const tStyle  = TYPE_STYLE[tmpl.chart_type]
            const tLabel  = TYPE_LABEL[tmpl.chart_type]
            return (
              <Card key={tmpl.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 border rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tStyle ? tStyle.bg : 'bg-white/5 border-white/10'
                    }`}>
                      <Icon size={20} className={tStyle ? tStyle.text : 'text-white/60'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-white font-semibold text-sm">{tmpl.nome}</p>
                        <Badge variant={COLOR_CAT[tmpl.categoria]}>{tmpl.categoria}</Badge>
                        {tLabel && <Badge variant={tStyle?.badge ?? 'default'}>{tLabel}</Badge>}
                        {tmpl.is_publico && <Badge variant="default">Público</Badge>}
                      </div>
                      <p className="text-white/40 text-xs mb-3">{tmpl.descricao}</p>

                      <div className="flex items-center gap-3 text-xs text-white/30 mb-4">
                        {tmpl.chart_type === 'report'
                          ? <span>Colunas: <span className="text-white/60">{tmpl.report_config?.columns.length ?? 0}</span></span>
                          : tmpl.chart_type === 'kpi'
                            ? <span>Métricas: <span className="text-white/60">{tmpl.kpi_config?.metrics.length ?? 0}</span></span>
                            : tmpl.chart_type === 'button'
                              ? <span>Botões: <span className="text-white/60">{tmpl.button_config?.buttons.length ?? 0}</span></span>
                              : <span>Tipo: <span className="text-white/60 capitalize">{tmpl.chart_type}</span></span>
                        }
                        {tmpl.chart_type !== 'button' && (
                          <span>Refresh: <span className="text-white/60">{tmpl.query.refresh_seconds}s</span></span>
                        )}
                        <span>Role: <span className="text-white/60">{tmpl.permissions.min_role}</span></span>
                      </div>

                      {/* SQL preview */}
                      <div className="bg-black/30 rounded-lg p-3 mb-4">
                        <code className="text-green-400/70 text-[10px] font-mono line-clamp-2 leading-relaxed">
                          {tmpl.query.sql}
                        </code>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/graficos/${tmpl.id}`}>
                          <Button variant="secondary" size="sm">
                            <Edit2 size={12} />Editar
                          </Button>
                        </Link>
                        <Button variant="secondary" size="sm">
                          <Copy size={12} />Duplicar
                        </Button>
                        <Button variant="danger" size="sm" className="ml-auto">
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
