export type UserRole  = 'operador' | 'gerente' | 'dono'

// ── Período de datas ──────────────────────────────────────────────────────────
export interface DateRange {
  from: Date | null
  to:   Date | null
}
export type ChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'area' | 'report' | 'kpi' | 'heatmap' | 'waterfall' | 'button' | 'tank' | 'multiblock'

// ── Tank Widget (Estoque de Tanques) ──────────────────────────────────────────
export interface TankProductColor {
  produto: string   // nome exato do produto (match case-insensitive)
  color:   string   // hex color, ex: '#3b82f6'
}

export interface TankConfig {
  field_produto:     string   // campo SQL com nome do produto
  field_volume:      string   // campo SQL com volume atual (litros)
  field_capacidade:  string   // campo SQL com capacidade total
  field_disponivel?: string   // campo SQL com espaço disponível (calculado se omitido)
  field_percentual?: string   // campo SQL com % (calculado de vol/cap se omitido)
  unidade:           string   // rótulo da unidade — padrão 'L'
  threshold_low:     number   // % abaixo = vermelho (padrão 25)
  threshold_mid:     number   // % abaixo = amarelo (padrão 50)
  colunas:           1 | 2   // tanques por linha

  // Aparência — tamanhos de fonte (px)
  font_size_produto?:    number   // nome do produto (padrão 12)
  font_size_volume?:     number   // volume atual — número grande (padrão 20)
  font_size_percentual?: number   // badge % no cilindro SVG (padrão 11)

  // Cores fixas por produto (sobrescreve cor de threshold quando definido)
  product_colors?: TankProductColor[]
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
export interface KpiMetric {
  field:        string
  label:        string
  format?:      'currency' | 'number' | 'percent'
  delta_field?: string
  delta_label?: string
  icon?:        string    // nome do ícone Lucide
  color?:       string
  sparkline?:   boolean
}

export interface KpiConfig {
  metrics: KpiMetric[]   // 1-4
  layout:  '1' | '2' | '4'
}

// ── Button Widget ─────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonAction {
  type:         'navigate' | 'template' | 'url'
  route?:       string
  template_id?: string
  url?:         string
}

export interface ButtonWidgetItem {
  icon?:    string
  label:    string
  size?:    ButtonSize
  variant?: ButtonVariant
  color?:   string   // cor customizada — sobrescreve a cor do variant
  action:   ButtonAction
}

export interface ButtonWidgetConfig {
  buttons: ButtonWidgetItem[]
  layout:  'horizontal' | 'vertical' | 'grid'
}

// ── Report (tabela) ───────────────────────────────────────────────────────────
export type ReportColumnFormat = 'currency' | 'number' | 'percent' | 'date' | 'datetime' | 'badge' | 'text'
export type ReportColumnAlign  = 'left' | 'center' | 'right'
export type ReportSummaryFn    = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none'

export interface ReportColumn {
  field:    string
  label:    string
  format?:  ReportColumnFormat
  align?:   ReportColumnAlign
  width?:   'xs' | 'sm' | 'md' | 'lg' | 'auto'
  summary?: ReportSummaryFn
}

export interface ReportConfig {
  columns:      ReportColumn[]
  sort_field?:  string
  sort_dir?:    'asc' | 'desc'
  show_totals?: boolean
  show_index?:  boolean
}
export type Plano = 'basic' | 'pro' | 'enterprise'

export interface Empresa {
  id: number
  nome: string
  cnpj_filial?: string
  is_master: boolean
}

export interface Cliente {
  id: string
  nome: string
  cnpj: string
  email: string
  telefone?: string
  plano: Plano
  ativo: boolean
  empresas: Empresa[]
  created_at: string
  // agente (pode ser null se não instalado)
  agente_status?:             'online' | 'offline' | 'degraded' | null
  agente_ultimo_heartbeat?:   string | null
}

export interface AxisY {
  field: string
  label: string
  format?: string
  color?: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export type WidgetSize = '1' | '2' | '3'   // colunas em grid de 3

export interface DashboardWidget {
  id:          string       // uuid do widget neste dashboard (não do template)
  template_id: string       // ChartMetadata.id
  size:        WidgetSize   // 1 = 1/3 · 2 = 2/3 · 3 = largura total
  order:       number
}

export interface Dashboard {
  id:         string
  nome:       string
  descricao?: string
  icone?:     string        // nome do ícone Lucide (opcional)
  cor?:       string        // cor de destaque (opcional)
  widgets:    DashboardWidget[]
  created_at: string
}

// ── Filtro de data do template ────────────────────────────────────────────────
export type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'custom'

export interface TemplateDateFilter {
  enabled:        boolean
  /** 'date' → substitui :data_inicio/:data_fim (YYYY-MM-DD)
   *  'datetime' → substitui :datetime_inicio/:datetime_fim (YYYY-MM-DD HH:MM:SS) */
  filter_type:    'date' | 'datetime'
  param_inicio:   string       // ex: ':data_inicio' ou ':datetime_inicio'
  param_fim:      string       // ex: ':data_fim'    ou ':datetime_fim'
  default_preset: DatePreset   // período padrão quando abrir o dashboard
  default_from?:  string       // ISO — usado quando preset === 'custom'
  default_to?:    string       // ISO — usado quando preset === 'custom'
}

export interface ChartMetadata {
  id: string
  nome: string
  descricao?: string
  categoria: string
  chart_type: ChartType
  query: {
    sql: string
    refresh_seconds: number
    timeout_seconds: number
  }
  date_filter?: TemplateDateFilter
  axes: {
    x: { field: string; label: string; format?: string }
    y: AxisY[]
  }
  display: {
    height: 'sm' | 'md' | 'lg'
    show_legend: boolean
    show_tooltip: boolean
    gradient?: boolean
    // Ícone exibido nos cards de menu do PWA (lucide icon name)
    icon?:       string
    icon_color?: string   // ex: '#009c3b' (cor do stroke)
    icon_bg?:    string   // ex: '#C5E8D6' (cor do quadrado de fundo)
  }
  permissions:    { min_role: UserRole }
  is_publico:     boolean
  cliente_ids?:   string[]
  report_config?:    ReportConfig        // chart_type === 'report'
  kpi_config?:       KpiConfig           // chart_type === 'kpi'
  button_config?:    ButtonWidgetConfig  // chart_type === 'button'
  tank_config?:      TankConfig          // chart_type === 'tank'
  multiblock_config?: MultiblockConfig   // chart_type === 'multiblock'
  created_at?:    string
}

// ── Multiblock — 1 SQL renderiza N visualizações do mesmo dataset ────────────
export type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last'

export type KpiFormat = 'number' | 'currency' | 'percent' | 'litros' | 'text'

export interface MbKpiBlock {
  type:    'kpi'
  title:   string
  field:   string
  agg:     AggregateFn
  format:  KpiFormat
  icon?:   string
  color?:  string
}

export interface MbDonutBlock {
  type:        'donut'
  title:       string
  groupBy:     string          // ex: 'produto'
  valueField:  string          // ex: 'valor'
  valueAgg?:   AggregateFn     // default 'sum'
  topN?:       number          // limita ao top N (resto vira "Outros")
  showLegend?: boolean
}

export interface MbTableBlock {
  type:        'table'
  title?:      string
  columns:     ReportColumn[]   // reusa formato de report
  showTotals?: boolean
  maxRows?:    number
}

export interface MbBarBlock {
  type:        'bar'
  title:       string
  xField:      string
  yField:      string
  yAgg?:       AggregateFn      // default 'sum'
  orientation?: 'h' | 'v'
}

export type MultiBlock = MbKpiBlock | MbDonutBlock | MbTableBlock | MbBarBlock

export interface MultiblockConfig {
  blocks:  MultiBlock[]
  layout?: {
    /** Grid em colunas. Ex: 'kpis-row' = KPIs em linha no topo, demais empilhados */
    preset?: 'kpis-top' | 'side-by-side' | 'stacked'
  }
}

export interface Licenca {
  id: string
  cliente_id: string
  tipo: string
  ativa: boolean
  data_inicio: string
  data_expiracao: string
  max_usuarios: number
  max_graficos: number
  jwt_token?: string
}

export interface AuditEntry {
  id: number
  cliente_id: string
  usuario_id: string
  acao: string
  recurso: string
  payload: Record<string, unknown>
  ip_address: string
  created_at: string
}

// Mock data para desenvolvimento
export const MOCK_CLIENTES: Cliente[] = [
  {
    id: 'cli-001',
    nome: 'Posto Central Ltda',
    cnpj: '12.345.678/0001-99',
    email: 'contato@postocentral.com.br',
    telefone: '(11) 9 9999-0001',
    plano: 'pro',
    ativo: true,
    empresas: [
      { id: 1, nome: 'Posto Central',     is_master: true  },
      { id: 2, nome: 'Posto Filial Norte', is_master: false },
    ],
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'cli-002',
    nome: 'Rede Petro Sul S.A.',
    cnpj: '98.765.432/0001-11',
    email: 'ti@petrosul.com.br',
    telefone: '(51) 3 3333-0002',
    plano: 'enterprise',
    ativo: true,
    empresas: [
      { id: 3, nome: 'Petro Sul Matriz',   is_master: true  },
      { id: 4, nome: 'Petro Sul Filial 1', is_master: false },
      { id: 5, nome: 'Petro Sul Filial 2', is_master: false },
    ],
    created_at: '2026-02-20T14:30:00Z',
  },
  {
    id: 'cli-003',
    nome: 'Posto Familiar ME',
    cnpj: '55.123.456/0001-77',
    email: 'dono@postofamiliar.com.br',
    plano: 'basic',
    ativo: false,
    empresas: [
      { id: 6, nome: 'Posto Familiar', is_master: true },
    ],
    created_at: '2026-03-01T09:00:00Z',
  },
]

export const CATEGORIAS = ['vendas', 'estoque', 'financeiro', 'operacional', 'geral']

// ── Sessão do usuário PWA (gerada pelo pwa-login e usada no preview) ──────────
export interface UserSession {
  id:         string
  nome:       string
  email:      string
  role:       UserRole
  cliente_id: string
  cnpj:       string
  empresas:   Array<{ id: number; nome: string; is_master: boolean }>
  jwt:        string
  expires_at: number
}
