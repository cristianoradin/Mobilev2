// Package discount implementa o fluxo de autorização de desconto.
//
// Fluxo:
//  1. PDV chama POST /api/desconto/request (HTTP local)
//  2. DescontoService gera notification_id e publica no MQTT:
//     - sga/{cnpj}/autorizacoes → PWA atualiza a tela em tempo real
//     - sga/{cnpj}/alert        → showLocal() quando o app está aberto
//  3. Chama portal POST /api/push/send → Web Push ao celular do dono/gerente
//  4. Dono abre /autorizacoes e aprova/rejeita via MQTT DESCONTO_RESPONSE
package discount

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/sga-petro/agent/pkg/models"
)

// PublishFunc é a assinatura que o AgentClient expõe.
type PublishFunc func(topic string, payload []byte, qos byte, retain bool)

// DescontoService orquestra a notificação de solicitações de desconto.
type DescontoService struct {
	publish    PublishFunc
	cnpjClean  string  // CNPJ sem pontuação (para tópicos MQTT)
	cnpjFmt    string  // CNPJ formatado (enviado ao portal)
	portalURL  string  // ex: https://mobilev2.gruposgapetro.com.br:8443
	pushSecret string  // Bearer token (pode ser vazio)
	httpClient *http.Client
	log        *zap.Logger
}

// New cria um DescontoService.
func New(publish PublishFunc, cnpjClean, cnpjFmt, portalURL, pushSecret string, log *zap.Logger) *DescontoService {
	return &DescontoService{
		publish:    publish,
		cnpjClean:  cnpjClean,
		cnpjFmt:    cnpjFmt,
		portalURL:  portalURL,
		pushSecret: pushSecret,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		log:        log,
	}
}

// SolicitacaoInput são os dados recebidos do PDV via HTTP.
type SolicitacaoInput struct {
	Bico               int     `json:"bico"`
	Litros             float64 `json:"litros"`
	ValorTotal         float64 `json:"valor_total"`
	DescontoSolicitado float64 `json:"desconto_solicitado"` // percentual, ex: 5.0
	OperadorID         string  `json:"operador_id"`
	OperadorNome       string  `json:"operador_nome,omitempty"`
}

// Validate verifica campos obrigatórios.
func (s *SolicitacaoInput) Validate() error {
	if s.Bico <= 0 {
		return fmt.Errorf("bico inválido: %d", s.Bico)
	}
	if s.Litros <= 0 {
		return fmt.Errorf("litros inválido: %.2f", s.Litros)
	}
	if s.ValorTotal <= 0 {
		return fmt.Errorf("valor_total inválido: %.2f", s.ValorTotal)
	}
	if s.DescontoSolicitado <= 0 || s.DescontoSolicitado > 100 {
		return fmt.Errorf("desconto_solicitado inválido: %.2f%%", s.DescontoSolicitado)
	}
	if s.OperadorID == "" {
		return fmt.Errorf("operador_id é obrigatório")
	}
	return nil
}

// NotificarDesconto processa uma solicitação de desconto do PDV:
// publica no MQTT e dispara Web Push via portal. Retorna o notification_id gerado.
func (s *DescontoService) NotificarDesconto(input SolicitacaoInput) (string, error) {
	if err := input.Validate(); err != nil {
		return "", fmt.Errorf("dados inválidos: %w", err)
	}

	notifID := uuid.New().String()
	now := time.Now().UnixMilli()

	// ── 1. Publica no tópico de autorizações (PWA atualiza a tela) ────────────
	req := models.DescontoRequest{
		Type:               "DESCONTO_REQUEST",
		NotificationID:     notifID,
		Bico:               input.Bico,
		Litros:             input.Litros,
		ValorTotal:         input.ValorTotal,
		DescontoSolicitado: input.DescontoSolicitado,
		OperadorID:         input.OperadorID,
		OperadorNome:       input.OperadorNome,
		Timestamp:          now,
	}

	autorizacoesTopic := fmt.Sprintf("sga/%s/autorizacoes", s.cnpjClean)
	if payload, err := json.Marshal(req); err == nil {
		// retain=false: o broker não guarda múltiplas mensagens; o histórico fica na tela do PWA
		s.publish(autorizacoesTopic, payload, 1, false)
		s.log.Info("DESCONTO_REQUEST publicado", zap.String("notification_id", notifID),
			zap.Int("bico", input.Bico), zap.Float64("desconto", input.DescontoSolicitado))
	}

	// ── 2. Publica no tópico de alerta (showLocal quando o app está aberto) ────
	alertTopic := fmt.Sprintf("sga/%s/alert", s.cnpjClean)
	alertPayload, _ := json.Marshal(map[string]interface{}{
		"type":            "discount_request",
		"notification_id": notifID,
		"bico":            input.Bico,
		"valor":           input.ValorTotal,
		"desconto":        input.DescontoSolicitado,
		"timestamp":       now,
	})
	s.publish(alertTopic, alertPayload, 1, false)

	// ── 3. Web Push via portal (app fechado / background) ─────────────────────
	go s.enviarWebPush(input, notifID)

	return notifID, nil
}

// enviarWebPush chama POST /api/push/send no portal para entregar a notificação
// ao celular do dono/gerente mesmo com o app fechado.
func (s *DescontoService) enviarWebPush(input SolicitacaoInput, notifID string) {
	if s.portalURL == "" {
		s.log.Warn("portal.url não configurado — Web Push ignorado")
		return
	}

	operador := input.OperadorNome
	if operador == "" {
		operador = input.OperadorID
	}
	valorFinal := input.ValorTotal * (1 - input.DescontoSolicitado/100)

	body, _ := json.Marshal(map[string]interface{}{
		"cnpj":     s.cnpjFmt,
		"title":    "🔔 Autorização de Desconto",
		"body":     fmt.Sprintf("Bico %d · %s · R$ %.2f → R$ %.2f (%.0f%% desc.)", input.Bico, operador, input.ValorTotal, valorFinal, input.DescontoSolicitado),
		"tag":      "discount_request",
		"priority": "high",
		"data": map[string]interface{}{
			"route":           "/autorizacoes",
			"notification_id": notifID,
		},
	})

	url := s.portalURL + "/api/push/send"
	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		s.log.Error("erro criando request Web Push", zap.Error(err))
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if s.pushSecret != "" {
		httpReq.Header.Set("Authorization", "Bearer "+s.pushSecret)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		s.log.Warn("falha ao chamar portal/api/push/send",
			zap.String("url", url), zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		s.log.Warn("portal retornou erro em /api/push/send",
			zap.Int("status", resp.StatusCode))
		return
	}

	s.log.Info("Web Push enviado via portal",
		zap.String("notification_id", notifID),
		zap.Int("status", resp.StatusCode))
}
