package commands

import (
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/auth"
	"github.com/sga-petro/agent/internal/database"
	"github.com/sga-petro/agent/internal/query"
	"github.com/sga-petro/agent/pkg/models"
)

// ReadHandler processa comandos READ_QUERY
type ReadHandler struct {
	executor  *query.Executor
	cache     *database.CacheDB
	validator *auth.Validator
	log       *zap.Logger
}

// NewReadHandler cria um handler de leitura
func NewReadHandler(ex *query.Executor, cache *database.CacheDB, v *auth.Validator, log *zap.Logger) *ReadHandler {
	return &ReadHandler{executor: ex, cache: cache, validator: v, log: log}
}

// Handle processa um comando READ_QUERY e retorna o payload de resposta JSON
func (h *ReadHandler) Handle(cmd *models.MQTTCommand) ([]byte, error) {
	// Valida JWT do usuário PWA
	userClaims, err := h.validator.ValidateUserJWT(cmd.UserJWT)
	if err != nil {
		h.log.Warn("JWT de usuário inválido", zap.Error(err))
		return buildErrorResponse(cmd.RequestID, cmd.TemplateID, "unauthorized", "JWT inválido"), nil
	}

	// Busca o metadata do template no cache local
	templateBytes, err := h.cache.GetTemplate(cmd.TemplateID)
	if err != nil || templateBytes == nil {
		return buildErrorResponse(cmd.RequestID, cmd.TemplateID, "error", "template não encontrado — sincronize via portal"), nil
	}

	var metadata models.ChartMetadata
	if err := json.Unmarshal(templateBytes, &metadata); err != nil {
		return buildErrorResponse(cmd.RequestID, cmd.TemplateID, "error", "metadata corrompido"), nil
	}

	// Verifica permissão mínima do template
	if !auth.RoleHasPermission(userClaims.Role, metadata.Permissions.MinRole) {
		h.log.Info("acesso negado por permissão",
			zap.String("user", userClaims.UserID),
			zap.String("role", string(userClaims.Role)),
			zap.String("min_role", string(metadata.Permissions.MinRole)),
		)
		return buildErrorResponse(cmd.RequestID, cmd.TemplateID, "denied", "permissão insuficiente"), nil
	}

	// Filtra empresas: apenas as que o usuário tem acesso
	empresaIDs := cmd.EmpresasIDs

	// Executa a query com CNPJ injection e gestão de cache
	result, err := h.executor.ExecuteReadQuery(
		cmd.TemplateID,
		metadata.Nome,
		metadata.Query.SQL,
		empresaIDs,
		metadata.Query.TimeoutSeconds,
		metadata.Query.RefreshSeconds/60,
		cmd.ForceRefresh,
	)
	if err != nil {
		h.log.Error("erro na execução da query",
			zap.String("template", cmd.TemplateID),
			zap.Error(err),
		)
		return buildErrorResponse(cmd.RequestID, cmd.TemplateID, "error", fmt.Sprintf("erro na query: %v", err)), nil
	}

	resp := models.MQTTResponse{
		Type:            "READ_RESULT",
		RequestID:       cmd.RequestID,
		TemplateID:      cmd.TemplateID,
		Status:          "success",
		Data:            result.Data,
		Cached:          result.Cached,
		CacheAgeSeconds: result.CacheAgeSec,
		RowCount:        result.RowCount,
		Timestamp:       time.Now().UnixMilli(),
	}

	h.log.Info("query executada",
		zap.String("template", cmd.TemplateID),
		zap.Bool("cached", result.Cached),
		zap.Int("rows", result.RowCount),
	)

	return json.Marshal(resp)
}

func buildErrorResponse(requestID, templateID, status, msg string) []byte {
	resp := models.MQTTResponse{
		Type:         "READ_RESULT",
		RequestID:    requestID,
		TemplateID:   templateID,
		Status:       status,
		ErrorMessage: msg,
		Timestamp:    time.Now().UnixMilli(),
	}
	b, _ := json.Marshal(resp)
	return b
}
