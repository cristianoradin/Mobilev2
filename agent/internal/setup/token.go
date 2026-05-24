// Package setup implementa o instalador automático do agente.
// O "setup token" é um JSON codificado em base64url com prefixo "sga1_".
// Contém tudo que o instalador precisa, exceto (opcionalmente) a senha do banco.
package setup

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
)

const tokenPrefix = "sga1_"

// SetupToken é o payload decodificado do token de instalação.
// Gerado pelo portal quando o admin clica em "Gerar Instalador".
type SetupToken struct {
	// JWT do agente — contém CNPJ, plano, empresas, sub (cliente_id)
	JWT string `json:"jwt"`

	// Nome do cliente (para exibição durante instalação)
	ClienteNome string `json:"cliente_nome"`

	// Configuração do broker MQTT
	Broker    string `json:"broker"`     // ex: "mqtts://mobilev2.gruposgapetro.com.br:8883"
	MQTTUser  string `json:"mqtt_user"`  // ex: "agent"
	MQTTPass  string `json:"mqtt_pass"`  // pode ser vazio (anonymous)

	// Portal e push
	PortalURL  string `json:"portal_url"`
	PushSecret string `json:"push_secret"`

	// Configuração do banco de dados local do cliente
	DB SetupDB `json:"db"`
}

// SetupDB são as configurações de conexão com o PostgreSQL local do posto.
// Password é opcional — se vazio, o instalador pede ao técnico.
type SetupDB struct {
	Host     string `json:"host"`               // default: "localhost"
	Port     int    `json:"port"`               // default: 5432
	Name     string `json:"name"`               // obrigatório — ex: "sga"
	User     string `json:"user"`               // default: "postgres"
	Password string `json:"password,omitempty"` // opcional — pedir se vazio
}

// Encode serializa um SetupToken para a string sga1_<base64url>.
func Encode(t *SetupToken) (string, error) {
	data, err := json.Marshal(t)
	if err != nil {
		return "", fmt.Errorf("serializando token: %w", err)
	}
	encoded := base64.RawURLEncoding.EncodeToString(data)
	return tokenPrefix + encoded, nil
}

// Decode decodifica uma string sga1_<base64url> para SetupToken.
func Decode(raw string) (*SetupToken, error) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, tokenPrefix) {
		return nil, fmt.Errorf("token inválido: deve começar com '%s'", tokenPrefix)
	}

	encoded := strings.TrimPrefix(raw, tokenPrefix)
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decodificando token: %w", err)
	}

	var t SetupToken
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, fmt.Errorf("parsing token: %w", err)
	}

	if t.JWT == "" {
		return nil, fmt.Errorf("token inválido: JWT ausente")
	}
	if t.Broker == "" {
		return nil, fmt.Errorf("token inválido: broker ausente")
	}

	return &t, nil
}
