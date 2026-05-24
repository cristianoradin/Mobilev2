/**
 * Catálogo de templates do sistema (definidos pela SGA).
 * Fonte única — usada pela página /graficos e pela API mobile.
 */
import type { ChartMetadata } from '@/lib/types'

export const SYSTEM_TEMPLATES: ChartMetadata[] = [
  {
    id: 'tmpl-001', nome: 'Vendas por Hora', descricao: 'Volume de vendas agrupado por hora do dia',
    categoria: 'vendas', chart_type: 'area', is_publico: false,
    query: { sql: 'SELECT hora, total FROM vendas WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'hora', label: 'Hora' }, y: [{ field: 'total', label: 'Total R$', color: '#009c3b' }] },
    display: { height: 'md', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'operador' },
  },
  {
    id: 'tmpl-002', nome: 'Nível dos Tanques', descricao: 'Percentual atual de combustível em cada tanque',
    categoria: 'estoque', chart_type: 'gauge', is_publico: false,
    query: { sql: 'SELECT nivel FROM tanques WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'tanque', label: 'Tanque' }, y: [{ field: 'nivel', label: '%', color: '#3b82f6' }] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  {
    id: 'tmpl-003', nome: 'Mix de Combustível', descricao: 'Participação % de cada combustível nas vendas',
    categoria: 'vendas', chart_type: 'pie', is_publico: false,
    query: { sql: 'SELECT tipo, sum(litros) as litros FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY tipo', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'tipo', label: 'Tipo' }, y: [{ field: 'litros', label: 'Litros', color: '#f97316' }] },
    display: { height: 'sm', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'gerente' },
  },
  {
    id: 'tmpl-004', nome: 'Faturamento Mensal', descricao: 'Evolução do faturamento nos últimos 30 dias',
    categoria: 'financeiro', chart_type: 'bar', is_publico: false,
    query: { sql: 'SELECT data, total FROM faturamento WHERE empresa_id IN (:empresas_filtradas) AND data >= NOW()-30', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'data', label: 'Data' }, y: [{ field: 'total', label: 'Faturamento', color: '#fbbf24' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'dono' },
  },
  {
    id: 'tmpl-005', nome: 'Relatório de Vendas por Produto', descricao: 'Tabela detalhada de vendas agrupadas por combustível com totais',
    categoria: 'vendas', chart_type: 'report', is_publico: false,
    query: { sql: 'SELECT produto, SUM(litros) AS quantidade, SUM(total) AS total FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY produto ORDER BY total DESC', refresh_seconds: 300, timeout_seconds: 30 },
    axes: { x: { field: 'produto', label: 'Produto' }, y: [{ field: 'total', label: 'Total' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  {
    id: 'tmpl-006', nome: 'KPI — Indicadores do Dia', descricao: '4 métricas-chave em tempo real',
    categoria: 'vendas', chart_type: 'kpi', is_publico: false,
    query: { sql: 'SELECT litros, faturamento, margem, abastecimentos FROM resumo_dia WHERE empresa_id IN (:empresas_filtradas)', refresh_seconds: 60, timeout_seconds: 15 },
    axes: { x: { field: 'label', label: 'Métrica' }, y: [] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  {
    id: 'tmpl-007', nome: 'Heatmap — Movimento por Hora/Dia', descricao: 'Intensidade de vendas por hora × dia da semana',
    categoria: 'operacional', chart_type: 'heatmap', is_publico: false,
    query: { sql: 'SELECT EXTRACT(hour FROM created_at)/3*3 AS hora, EXTRACT(dow FROM created_at) AS dia, SUM(litros) AS litros FROM vendas WHERE empresa_id IN (:empresas_filtradas) GROUP BY hora, dia', refresh_seconds: 3600, timeout_seconds: 60 },
    axes: { x: { field: 'hora', label: 'Horário' }, y: [{ field: 'dia', label: 'Dia' }, { field: 'litros', label: 'Volume (L)' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: true },
    permissions: { min_role: 'gerente' },
  },
  {
    id: 'tmpl-008', nome: 'Waterfall — Resultado do Período', descricao: 'Composição do resultado: faturamento → custos → margem',
    categoria: 'financeiro', chart_type: 'waterfall', is_publico: false,
    query: { sql: 'SELECT componente, valor FROM resultado_periodo WHERE empresa_id IN (:empresas_filtradas) ORDER BY ordem', refresh_seconds: 86400, timeout_seconds: 60 },
    axes: { x: { field: 'componente', label: 'Componente' }, y: [{ field: 'valor', label: 'Valor (R$)', color: '#009c3b' }] },
    display: { height: 'lg', show_legend: true, show_tooltip: true },
    permissions: { min_role: 'dono' },
  },
  {
    id: 'tmpl-009', nome: 'Botões — Ações Rápidas', descricao: 'Atalhos de tela: estoque, troca de preço e autorizações',
    categoria: 'operacional', chart_type: 'button', is_publico: false,
    query: { sql: '', refresh_seconds: 0, timeout_seconds: 0 },
    axes: { x: { field: '', label: '' }, y: [] },
    display: { height: 'sm', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
  },
  {
    id: 'tmpl-010', nome: 'Estoque de Tanques', descricao: 'Nível visual dos tanques de combustível com cilindros 3D e alertas de nível',
    categoria: 'estoque', chart_type: 'tank', is_publico: false,
    query: {
      sql: 'SELECT produto, volume, capacidade FROM estoque_tanques WHERE empresa_id IN (:empresas_filtradas) ORDER BY produto',
      refresh_seconds: 60, timeout_seconds: 15,
    },
    axes: { x: { field: 'produto', label: 'Produto' }, y: [{ field: 'volume', label: 'Volume (L)' }] },
    display: { height: 'lg', show_legend: false, show_tooltip: false },
    permissions: { min_role: 'operador' },
    tank_config: {
      field_produto:    'produto',
      field_volume:     'volume',
      field_capacidade: 'capacidade',
      unidade:          'L',
      threshold_low:    25,
      threshold_mid:    50,
      colunas:          2,
    },
  },
]

// Mocks removidos — todos os dashboards são criados e gerenciados pelo admin no DB
