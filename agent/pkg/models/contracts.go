package models

import "time"

// ChartType representa os tipos de gráfico suportados
type ChartType string

const (
	ChartLine  ChartType = "line"
	ChartBar   ChartType = "bar"
	ChartPie   ChartType = "pie"
	ChartGauge ChartType = "gauge"
	ChartArea  ChartType = "area"
)

// UserRole define os níveis de permissão
type UserRole string

const (
	RoleOwner    UserRole = "dono"
	RoleManager  UserRole = "gerente"
	RoleOperator UserRole = "operador"
)

// CommandType tipos de comandos recebidos via MQTT
type CommandType string

const (
	CmdReadQuery        CommandType = "READ_QUERY"
	CmdWriteCmd         CommandType = "WRITE_COMMAND"
	CmdSyncTemplate     CommandType = "SYNC_TEMPLATE"
	CmdUpdateAgent      CommandType = "UPDATE_AGENT"
	CmdDiscoverEmpresas CommandType = "DISCOVER_EMPRESAS"
)

// WriteSubtype subtipos de comandos de escrita
type WriteSubtype string

const (
	SubtypePrecoUpdate   WriteSubtype = "PRECO_UPDATE"
	SubtypeDescontoResp  WriteSubtype = "DESCONTO_RESPONSE"
)

// MQTTCommand é o contrato base de comandos recebidos do MQTT
type MQTTCommand struct {
	Type          CommandType   `json:"type"`
	RequestID     string        `json:"request_id"`
	TemplateID    string        `json:"template_id,omitempty"`
	UserJWT       string        `json:"user_jwt"`
	EmpresasIDs   []int64       `json:"empresas_ids"`
	ForceRefresh  bool          `json:"force_refresh,omitempty"`
	Timestamp     int64         `json:"timestamp"`
	ResponseTopic string        `json:"response_topic,omitempty"`

	// Filtro de período (ISO date "YYYY-MM-DD" ou datetime "YYYY-MM-DD HH:MM:SS")
	// Usado para substituir :data_inicio/:data_fim e :datetime_inicio/:datetime_fim no SQL
	DateFrom string `json:"date_from,omitempty"`
	DateTo   string `json:"date_to,omitempty"`

	// Campos para WRITE_COMMAND
	Subtype WriteSubtype           `json:"subtype,omitempty"`
	Payload map[string]interface{} `json:"payload,omitempty"`
}

// MQTTResponse é o contrato de respostas enviadas ao MQTT
type MQTTResponse struct {
	Type          string                   `json:"type"`
	RequestID     string                   `json:"request_id"`
	TemplateID    string                   `json:"template_id,omitempty"`
	Status        string                   `json:"status"` // success | error | denied
	Data          []map[string]interface{} `json:"data,omitempty"`
	Cached        bool                     `json:"cached"`
	CacheAgeSeconds int64                  `json:"cache_age_seconds,omitempty"`
	RowCount      int                      `json:"row_count,omitempty"`
	ErrorMessage  string                   `json:"error_message,omitempty"`
	Timestamp     int64                    `json:"timestamp"`
}

// ChartMetadata define um template de gráfico
type ChartMetadata struct {
	ID        string    `json:"id"`
	Nome      string    `json:"nome"`
	ChartType ChartType `json:"chart_type"`
	Query     struct {
		SQL            string `json:"sql"`
		RefreshSeconds int    `json:"refresh_seconds"`
		TimeoutSeconds int    `json:"timeout_seconds"`
	} `json:"query"`
	Axes struct {
		X struct {
			Field  string `json:"field"`
			Label  string `json:"label"`
			Format string `json:"format,omitempty"`
		} `json:"x"`
		Y []struct {
			Field  string `json:"field"`
			Label  string `json:"label"`
			Format string `json:"format,omitempty"`
			Color  string `json:"color,omitempty"`
		} `json:"y"`
	} `json:"axes"`
	Display struct {
		Height      string `json:"height"`
		ShowLegend  bool   `json:"show_legend"`
		ShowTooltip bool   `json:"show_tooltip"`
		Gradient    bool   `json:"gradient,omitempty"`
	} `json:"display"`
	Permissions struct {
		MinRole UserRole `json:"min_role"`
	} `json:"permissions"`
}

// AgentClaims são os claims extraídos do JWT do agente
type AgentClaims struct {
	ClientID   string  `json:"sub"`
	CNPJ       string  `json:"cnpj"`
	Empresas   []int64 `json:"empresas"`
	Plano      string  `json:"plano"`
	Type       string  `json:"type"`
}

// UserClaims são os claims extraídos do JWT do usuário PWA
type UserClaims struct {
	UserID    string   `json:"sub"`
	ClientID  string   `json:"client_id"`
	CNPJ      string   `json:"cnpj"`
	Role      UserRole `json:"role"`
	Empresas  []int64  `json:"empresas"`
}

// DescontoRequest é publicado pelo agente no tópico sga/{cnpj}/autorizacoes
// quando o PDV solicita autorização de desconto ao proprietário/gerente.
type DescontoRequest struct {
	Type                string  `json:"type"`                 // sempre "DESCONTO_REQUEST"
	NotificationID      string  `json:"notification_id"`      // UUID gerado pelo agente
	Bico                int     `json:"bico"`
	Litros              float64 `json:"litros"`
	ValorTotal          float64 `json:"valor_total"`
	DescontoSolicitado  float64 `json:"desconto_solicitado"`  // percentual ex: 5.0
	OperadorID          string  `json:"operador_id"`
	OperadorNome        string  `json:"operador_nome,omitempty"`
	Timestamp           int64   `json:"timestamp"`            // UnixMilli
}

// AuditEntry representa um registro de auditoria
type AuditEntry struct {
	Timestamp   time.Time
	UserID      string
	UserRole    UserRole
	Acao        string
	Tabela      string
	RegistroID  string
	ValorAntes  interface{}
	ValorDepois interface{}
	IPOrigem    string
	Status      string // SUCCESS | DENIED | ERROR
}
