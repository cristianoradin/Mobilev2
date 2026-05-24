export type ChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'area' | 'tank' | 'report' | 'kpi' | 'heatmap' | 'waterfall' | 'button'

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
    show_legend: boolean
    show_tooltip: boolean
    gradient?: boolean
  }
  permissions:  { min_role: UserRole }
  tank_config?: TankConfig
  categoria?:   string
  descricao?:   string
  is_publico?:  boolean
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
  empresas: Array<{ id: number; nome: string; is_master: boolean }>
  jwt: string
  expires_at: number
}
