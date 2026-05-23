package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/auth"
	"github.com/sga-petro/agent/internal/database"
	"github.com/sga-petro/agent/pkg/models"
)

// WriteHandler processa comandos de escrita (WRITE_COMMAND)
type WriteHandler struct {
	pg        *database.PostgresDB
	cache     *database.CacheDB
	validator *auth.Validator
	cnpj      string
	log       *zap.Logger
}

// NewWriteHandler cria um handler de escrita
func NewWriteHandler(pg *database.PostgresDB, cache *database.CacheDB, v *auth.Validator, cnpj string, log *zap.Logger) *WriteHandler {
	return &WriteHandler{pg: pg, cache: cache, validator: v, cnpj: cnpj, log: log}
}

// Handle processa um WRITE_COMMAND e executa a operação com auditoria completa
func (h *WriteHandler) Handle(cmd *models.MQTTCommand) ([]byte, error) {
	// Valida JWT do usuário PWA
	userClaims, err := h.validator.ValidateUserJWT(cmd.UserJWT)
	if err != nil {
		h.log.Warn("JWT de usuário inválido em WRITE_COMMAND", zap.Error(err))
		return h.buildWriteResponse(cmd.RequestID, "denied", "JWT inválido"), nil
	}

	h.log.Info("WRITE_COMMAND recebido",
		zap.String("subtype", string(cmd.Subtype)),
		zap.String("user", userClaims.UserID),
		zap.String("role", string(userClaims.Role)),
	)

	switch cmd.Subtype {
	case models.SubtypePrecoUpdate:
		return h.handlePrecoUpdate(cmd, userClaims)
	case models.SubtypeDescontoResp:
		return h.handleDescontoResponse(cmd, userClaims)
	default:
		return h.buildWriteResponse(cmd.RequestID, "error", fmt.Sprintf("subtype desconhecido: %s", cmd.Subtype)), nil
	}
}

// handlePrecoUpdate processa uma atualização de preço de combustível
func (h *WriteHandler) handlePrecoUpdate(cmd *models.MQTTCommand, user *models.UserClaims) ([]byte, error) {
	// Apenas DONO e GERENTE podem alterar preços
	if !auth.RoleHasPermission(user.Role, models.RoleManager) {
		h.auditLog(user, "PRECO_UPDATE", "DENIED", cmd.Payload, nil)
		return h.buildWriteResponse(cmd.RequestID, "denied", "apenas gerente ou dono pode alterar preços"), nil
	}

	produtoID, ok := extractInt(cmd.Payload, "produto_id")
	if !ok {
		return h.buildWriteResponse(cmd.RequestID, "error", "produto_id inválido"), nil
	}

	novoPreco, ok := extractFloat(cmd.Payload, "novo_preco")
	if !ok || novoPreco <= 0 {
		return h.buildWriteResponse(cmd.RequestID, "error", "novo_preco inválido"), nil
	}

	precoAnterior, _ := extractFloat(cmd.Payload, "preco_anterior")

	// Executa o UPDATE com CNPJ injection garantida e parâmetros seguros
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	affected, err := h.pg.ExecWrite(ctx,
		`UPDATE produtos SET preco = $1, updated_at = NOW()
		 WHERE id = $2 AND cnpj_empresa = $3`,
		novoPreco, produtoID, h.cnpj,
	)

	if err != nil {
		h.log.Error("erro no UPDATE de preço", zap.Error(err))
		h.auditLog(user, "PRECO_UPDATE", "ERROR", cmd.Payload, map[string]interface{}{"error": err.Error()})
		return h.buildWriteResponse(cmd.RequestID, "error", "erro ao atualizar preço"), nil
	}

	if affected == 0 {
		h.auditLog(user, "PRECO_UPDATE", "NOT_FOUND", cmd.Payload, nil)
		return h.buildWriteResponse(cmd.RequestID, "error", "produto não encontrado ou não pertence a este CNPJ"), nil
	}

	// Grava audit log com os valores antes e depois
	h.auditLog(user, "PRECO_UPDATE", "SUCCESS",
		map[string]interface{}{"produto_id": produtoID, "preco": precoAnterior},
		map[string]interface{}{"produto_id": produtoID, "preco": novoPreco},
	)

	h.log.Info("preço atualizado",
		zap.Int64("produto_id", produtoID),
		zap.Float64("preco_anterior", precoAnterior),
		zap.Float64("novo_preco", novoPreco),
		zap.String("user", user.UserID),
	)

	return h.buildWriteResponse(cmd.RequestID, "success", ""), nil
}

// handleDescontoResponse processa a resposta de autorização de desconto
func (h *WriteHandler) handleDescontoResponse(cmd *models.MQTTCommand, user *models.UserClaims) ([]byte, error) {
	// Apenas DONO e GERENTE podem autorizar descontos
	if !auth.RoleHasPermission(user.Role, models.RoleManager) {
		h.auditLog(user, "DESCONTO_RESPONSE", "DENIED", cmd.Payload, nil)
		return h.buildWriteResponse(cmd.RequestID, "denied", "apenas gerente ou dono pode autorizar descontos"), nil
	}

	notifID, _ := cmd.Payload["notification_id"].(string)
	aprovado, _ := cmd.Payload["aprovado"].(bool)
	observacao, _ := cmd.Payload["observacao"].(string)

	// Insere o registro de autorização na tabela local
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status := "REJEITADO"
	if aprovado {
		status = "APROVADO"
	}

	_, err := h.pg.ExecWrite(ctx,
		`INSERT INTO autorizacoes_desconto
			(notification_id, aprovado, status, observacao, autorizado_por, cnpj_empresa, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		notifID, aprovado, status, observacao, user.UserID, h.cnpj,
	)
	if err != nil {
		h.log.Error("erro ao gravar autorização", zap.Error(err))
		h.auditLog(user, "DESCONTO_RESPONSE", "ERROR", cmd.Payload, nil)
		return h.buildWriteResponse(cmd.RequestID, "error", "erro ao gravar autorização"), nil
	}

	h.auditLog(user, "DESCONTO_RESPONSE", "SUCCESS",
		nil,
		map[string]interface{}{"notification_id": notifID, "aprovado": aprovado, "observacao": observacao},
	)

	h.log.Info("desconto respondido",
		zap.String("notification_id", notifID),
		zap.Bool("aprovado", aprovado),
		zap.String("user", user.UserID),
	)

	return h.buildWriteResponse(cmd.RequestID, "success", ""), nil
}

func (h *WriteHandler) auditLog(user *models.UserClaims, acao, status string, antes, depois interface{}) {
	_ = h.cache.WriteAuditLog(database.AuditEntry{
		UserID:      user.UserID,
		UserRole:    user.Role,
		Acao:        acao,
		ValorAntes:  antes,
		ValorDepois: depois,
		Status:      status,
	})
}

func (h *WriteHandler) buildWriteResponse(requestID, status, errMsg string) []byte {
	resp := models.MQTTResponse{
		Type:         "WRITE_RESULT",
		RequestID:    requestID,
		Status:       status,
		ErrorMessage: errMsg,
		Timestamp:    time.Now().UnixMilli(),
	}
	b, _ := json.Marshal(resp)
	return b
}

func extractInt(m map[string]interface{}, key string) (int64, bool) {
	v, ok := m[key]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case int64:
		return n, true
	case int:
		return int64(n), true
	}
	return 0, false
}

func extractFloat(m map[string]interface{}, key string) (float64, bool) {
	v, ok := m[key]
	if !ok {
		return 0, false
	}
	f, ok := v.(float64)
	return f, ok
}
