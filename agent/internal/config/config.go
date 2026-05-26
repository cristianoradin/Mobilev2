package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type MQTTConfig struct {
	Broker                string `json:"broker"`
	ClientID              string `json:"client_id"`
	Username              string `json:"username"`
	Password              string `json:"password"`
	KeepAliveSeconds      int    `json:"keep_alive_seconds"`
	ReconnectWaitSeconds  int    `json:"reconnect_wait_seconds"`
}

type DatabaseConfig struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Name               string `json:"name"`
	User               string `json:"user"`
	Password           string `json:"password"`
	SSLMode            string `json:"ssl_mode"`
	MaxConnections     int    `json:"max_connections"`
	QueryTimeoutSeconds int   `json:"query_timeout_seconds"`
}

type CacheConfig struct {
	Path                string `json:"path"`
	MaxAgeMinutes       int    `json:"max_age_minutes"`
	VacuumIntervalHours int    `json:"vacuum_interval_hours"`
}

type LogConfig struct {
	Level      string `json:"level"`
	Path       string `json:"path"`
	MaxSizeMB  int    `json:"max_size_mb"`
	MaxBackups int    `json:"max_backups"`
}

// PortalConfig aponta para o portal administrativo (para envio de Web Push)
type PortalConfig struct {
	URL        string `json:"url"`         // ex: https://mobilev2.gruposgapetro.com.br:8443
	PushSecret string `json:"push_secret"` // Bearer token de autenticação (pode ser vazio em dev)
}

// HTTPConfig configura o servidor HTTP local exposto ao PDV
type HTTPConfig struct {
	Port int `json:"port"` // padrão: 8765
}

// UpdateConfig configura o poller automático de atualizações
type UpdateConfig struct {
	PollIntervalMinutes int  `json:"poll_interval_minutes"` // 0 = desativado, default 30
	Enabled             bool `json:"enabled"`               // default true
}

// WatchdogConfig configura o detector de travamentos
type WatchdogConfig struct {
	TimeoutMinutes int  `json:"timeout_minutes"` // default 5
	Enabled        bool `json:"enabled"`         // default true
}

type Config struct {
	AgentID     string         `json:"agent_id"`
	ClienteCNPJ string         `json:"cliente_cnpj"`
	JWTToken    string         `json:"jwt_token"`
	MQTT        MQTTConfig     `json:"mqtt"`
	Database    DatabaseConfig `json:"database"`
	Cache       CacheConfig    `json:"cache"`
	Log         LogConfig      `json:"log"`
	Portal      PortalConfig   `json:"portal"`
	HTTP        HTTPConfig     `json:"http"`
	Update      UpdateConfig   `json:"update"`
	Watchdog    WatchdogConfig `json:"watchdog"`
}

func Load(path string) (*Config, error) {
	// Variáveis de ambiente têm precedência sobre o arquivo
	cfg := &Config{
		AgentID:     getEnv("SGA_AGENT_ID", ""),
		ClienteCNPJ: getEnv("SGA_CNPJ", ""),
		JWTToken:    getEnv("SGA_JWT_TOKEN", ""),
	}

	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("lendo config: %w", err)
		}
		if err == nil {
			if err := json.Unmarshal(data, cfg); err != nil {
				return nil, fmt.Errorf("parsing config: %w", err)
			}
		}
	}

	// Env vars sobrescrevem o arquivo
	if v := getEnv("SGA_AGENT_ID", ""); v != "" {
		cfg.AgentID = v
	}
	if v := getEnv("SGA_CNPJ", ""); v != "" {
		cfg.ClienteCNPJ = v
	}
	if v := getEnv("SGA_JWT_TOKEN", ""); v != "" {
		cfg.JWTToken = v
	}
	if v := getEnv("SGA_MQTT_BROKER", ""); v != "" {
		cfg.MQTT.Broker = v
	}
	if v := getEnv("SGA_DB_PASSWORD", ""); v != "" {
		cfg.Database.Password = v
	}

	setDefaults(cfg)

	if err := validate(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func setDefaults(cfg *Config) {
	if cfg.MQTT.KeepAliveSeconds == 0 {
		cfg.MQTT.KeepAliveSeconds = 30
	}
	if cfg.MQTT.ReconnectWaitSeconds == 0 {
		cfg.MQTT.ReconnectWaitSeconds = 5
	}
	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5432
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Database.MaxConnections == 0 {
		cfg.Database.MaxConnections = 5
	}
	if cfg.Database.QueryTimeoutSeconds == 0 {
		cfg.Database.QueryTimeoutSeconds = 30
	}
	if cfg.Cache.Path == "" {
		cfg.Cache.Path = "./agent.db"
	}
	if cfg.Cache.MaxAgeMinutes == 0 {
		cfg.Cache.MaxAgeMinutes = 15
	}
	if cfg.Log.Level == "" {
		cfg.Log.Level = "info"
	}
	if cfg.Log.Path == "" {
		cfg.Log.Path = "./agent.log"
	}
	if cfg.HTTP.Port == 0 {
		cfg.HTTP.Port = 8765
	}
	if cfg.Log.MaxSizeMB == 0 {
		cfg.Log.MaxSizeMB = 20    // 20MB por arquivo
	}
	if cfg.Log.MaxBackups == 0 {
		cfg.Log.MaxBackups = 5    // mantém últimos 5
	}
	// Update poller: opt-out, não opt-in (default ativado).
	// JSON nativo não distingue "false explícito" de "campo ausente" para bool,
	// então usamos PollIntervalMinutes==0 como sinal de "usar default".
	if cfg.Update.PollIntervalMinutes == 0 && !cfg.Update.disabledExplicit() {
		cfg.Update.PollIntervalMinutes = 30
		cfg.Update.Enabled = true
	}
	if cfg.Watchdog.TimeoutMinutes == 0 && !cfg.Watchdog.disabledExplicit() {
		cfg.Watchdog.TimeoutMinutes = 5
		cfg.Watchdog.Enabled = true
	}
}

// disabledExplicit retorna true se o usuário declarou Enabled=false no JSON.
// Workaround: não há jeito de distinguir "campo ausente" de "false" com bool nativo,
// então tratamos como "se tudo zero/false → defaults aplicam (ligado)". Para desativar,
// definir explicitamente PollIntervalMinutes=-1 (poller) ou TimeoutMinutes=-1 (watchdog).
func (u UpdateConfig) disabledExplicit() bool   { return u.PollIntervalMinutes < 0 }
func (w WatchdogConfig) disabledExplicit() bool { return w.TimeoutMinutes < 0 }

func validate(cfg *Config) error {
	if cfg.JWTToken == "" {
		return fmt.Errorf("jwt_token é obrigatório (config ou SGA_JWT_TOKEN)")
	}
	if cfg.MQTT.Broker == "" {
		return fmt.Errorf("mqtt.broker é obrigatório")
	}
	if cfg.Database.Host == "" {
		return fmt.Errorf("database.host é obrigatório")
	}
	if cfg.Database.Name == "" {
		return fmt.Errorf("database.name é obrigatório")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
