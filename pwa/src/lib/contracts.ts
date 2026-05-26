export type ChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'area' | 'tank' | 'report' | 'kpi' | 'heatmap' | 'waterfall' | 'button' | 'multiblock'

// ── Tank Config ───────────────────────────────────────────────────────────────
export interface TankProductColor {
  produto: string
  color:   string
}

export interface TankConfig {
  field_produto:     string
  field_volume:      string
  field_capacidade:  string
  field_disponivel?: string
  field_percentual?: string
  unidade:           string
  threshold_low:     number
  threshold_mid:     number
  colunas:           1 | 2

  // Aparência
  font_size_produto?:    number
  font_size_volume?:     number
  font_size_percentual?: number
  product_colors?:       TankProductColor[]
}
export type UserRole  = 'operador' | 'gerente' | 'dono'

// ── Report Config ─────────────────────────────────────────────────────────────
export interface ReportColumn {
  field:    string
  label:    string
  format?:  'text' | 'number' | 'currency' | 'percent'
  align?:   'left' | 'right' | 'center'
  summary?: 'none' | 'sum'
}

export interface ReportConfig {
  columns:     ReportColumn[]
  showIndex?:  boolean
  show_index?: boolean
  showTotals?: boolean
  show_totals?: boolean
}

export interface ChartMetadata {
  id: string
  nome: string
  chart_type: ChartType
  query: {
    sql: string
    refresh_seconds: number
    timeout_seconds: number
  }
  axes: {
    x: { field: string; label: string; format?: string }
    y: Array<{ field: string; label: string; format?: string; color?: string }>
  }
  display: {
    height: 'sm' | 'md' | 'lg'
    // Aceita tanto snake_case (config original) quanto camelCase (API com postgres.camel)
    show_legend?:  boolean
    showLegend?:   boolean
    show_tooltip?: boolean
    showTooltip?:  boolean
    gradient?:     boolean
    // Ícone + cores nos cards de menu PWA
    icon?:        string
    icon_color?:  string
    iconColor?:   string
    icon_bg?:     string
    iconBg?:      string
  }
  permissions: {
    min_role?: UserRole  // snake_case (config original)
    minRole?:  UserRole  // camelCase (API com postgres.camel)
  }
  report_config?:     ReportConfig
  tank_config?:       TankConfig
  multiblock_config?: MultiblockConfig
  date_filter?:       TemplateDateFilter
  categoria?:         string
  descricao?:         string
  is_publico?:        boolean
}

// ── Filtro de data ───────────────────────────────────────────────────────────
export type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'custom'

export interface TemplateDateFilter {
  enabled:         boolean
  filter_type:     'date' | 'datetime'
  param_inicio:    string
  param_fim:       string
  default_preset:  DatePreset
  default_from?:   string
  default_to?:     string
}

// ── Multiblock — 1 SQL → N visualizações ─────────────────────────────────────
export type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last'
export type KpiFormat   = 'number' | 'currency' | 'percent' | 'litros' | 'text'

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
  groupBy:     string
  valueField:  string
  valueAgg?:   AggregateFn
  topN?:       number
  showLegend?: boolean
}
export interface MbTableBlock {
  type:        'table'
  title?:      string
  columns:     ReportColumn[]
  showTotals?: boolean
  maxRows?:    number
}
export interface MbBarBlock {
  type:         'bar'
  title:        string
  xField:       string
  yField:       string
  yAgg?:        AggregateFn
  orientation?: 'h' | 'v'
}
export type MultiBlock = MbKpiBlock | MbDonutBlock | MbTableBlock | MbBarBlock

export interface MultiblockConfig {
  blocks:  MultiBlock[]
  layout?: { preset?: 'kpis-top' | 'side-by-side' | 'stacked' }
}

export interface MQTTCommand {
  type: 'READ_QUERY' | 'WRITE_COMMAND' | 'SYNC_TEMPLATE'
  request_id: string
  template_id?: string
  user_jwt: string
  empresas_ids: number[]
  force_refresh?: boolean
  timestamp: number
}

export interface MQTTWriteCommand extends MQTTCommand {
  type: 'WRITE_COMMAND'
  subtype: 'PRECO_UPDATE' | 'DESCONTO_RESPONSE'
  payload: Record<string, unknown>
}

export interface MQTTResponse {
  type: 'READ_RESULT' | 'WRITE_RESULT' | 'ERROR'
  request_id: string
  template_id?: string
  status: 'success' | 'error' | 'denied'
  data?: Record<string, unknown>[]
  cached?: boolean
  cache_age_seconds?: number
  row_count?: number
  error_message?: string
  timestamp: number
}

export interface DescontoRequest {
  type: 'DESCONTO_REQUEST'
  notification_id: string
  bico: number
  litros: number
  valor_total: number
  desconto_solicitado: number
  operador_id:    string
  operador_nome?: string   // nome legível — preenchido pelo agente Go
  timestamp: number
}

export interface UserSession {
  id: string
  nome: string
  email: string
  role: UserRole
  cliente_id: string
  cnpj: string
  empresas: Array<{ id: number; nome: string; is_master: boolean; codigoErp?: number; codigo_erp?: number }>
  jwt: string
  expires_at: number
}
