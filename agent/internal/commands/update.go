package commands

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/inconshreveable/go-update"
	"go.uber.org/zap"

	"github.com/sga-petro/agent/pkg/models"
)

// UpdateHandler processa o comando UPDATE_AGENT recebido via MQTT.
// Fluxo: valida secret → baixa binário → verifica SHA256 → aplica → reinicia.
type UpdateHandler struct {
	pushSecret string        // deve bater com payload["secret"]
	version    string        // versão corrente (para log)
	log        *zap.Logger
	onApplied  func()        // chamado após substituição bem-sucedida (ex: restart do serviço)
}

// NewUpdateHandler cria um UpdateHandler.
// onApplied é chamado após a substituição do binário — normalmente triggera o restart do serviço.
func NewUpdateHandler(pushSecret, currentVersion string, onApplied func(), log *zap.Logger) *UpdateHandler {
	return &UpdateHandler{
		pushSecret: pushSecret,
		version:    currentVersion,
		log:        log,
		onApplied:  onApplied,
	}
}

// CurrentVersion devolve a versão corrente em runtime — útil pro poller comparar.
func (h *UpdateHandler) CurrentVersion() string { return h.version }

// ApplyUpdate baixa, verifica SHA256, aplica e dispara restart.
// Pode ser chamado pelo MQTT handler (com secret check externo) OU pelo poller
// (que é trigger interno confiável).
// Retorna nil em sucesso; loga e retorna erro caso contrário.
func (h *UpdateHandler) ApplyUpdate(newVersion, downloadURL, expectedHash string) error {
	if downloadURL == "" || expectedHash == "" || newVersion == "" {
		return fmt.Errorf("campos obrigatórios ausentes (version, url, sha256)")
	}

	if newVersion == h.version {
		h.log.Info("update ignorado — versão já é a corrente", zap.String("versao", newVersion))
		return nil
	}

	h.log.Info("UPDATE: iniciando",
		zap.String("versao_atual", h.version),
		zap.String("versao_nova", newVersion),
		zap.String("url", downloadURL),
	)

	// ── Download ────────────────────────────────────────────────────────────
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(downloadURL)
	if err != nil {
		h.log.Error("UPDATE: falha no download", zap.Error(err))
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		h.log.Error("UPDATE: download retornou status inesperado", zap.Int("status", resp.StatusCode))
		return fmt.Errorf("download HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.log.Error("UPDATE: erro lendo resposta do download", zap.Error(err))
		return err
	}

	h.log.Info("UPDATE: download concluído", zap.Int("bytes", len(body)))

	// ── Verifica SHA256 ─────────────────────────────────────────────────────
	sum := sha256.Sum256(body)
	got := hex.EncodeToString(sum[:])
	if got != expectedHash {
		h.log.Error("UPDATE: SHA256 não confere — abortando",
			zap.String("esperado", expectedHash),
			zap.String("recebido", got),
		)
		return fmt.Errorf("sha256 mismatch")
	}

	h.log.Info("UPDATE: SHA256 verificado", zap.String("sha256", got))

	// ── Substituição atômica do binário ─────────────────────────────────────
	// go-update lida com o bloqueio de arquivo do Windows (move current→.old, escreve novo).
	if err := update.Apply(bytes.NewReader(body), update.Options{}); err != nil {
		h.log.Error("UPDATE: falha ao aplicar", zap.Error(err))
		if rbErr := update.RollbackError(err); rbErr != nil {
			h.log.Error("UPDATE: rollback também falhou", zap.Error(rbErr))
		}
		return err
	}

	h.log.Info("UPDATE: binário substituído — reiniciando serviço", zap.String("versao_nova", newVersion))

	if h.onApplied != nil {
		h.onApplied()
	}
	return nil
}

// Handle processa um MQTTCommand do tipo UPDATE_AGENT.
// Exige secret correto (rotas push), depois chama ApplyUpdate.
func (h *UpdateHandler) Handle(cmd *models.MQTTCommand) {
	secret, _      := cmd.Payload["secret"].(string)
	newVersion, _  := cmd.Payload["version"].(string)
	downloadURL, _ := cmd.Payload["url"].(string)
	expectedHash, _ := cmd.Payload["sha256"].(string)

	if h.pushSecret == "" || secret != h.pushSecret {
		h.log.Warn("UPDATE_AGENT: secret inválido — comando ignorado")
		return
	}

	_ = h.ApplyUpdate(newVersion, downloadURL, expectedHash)
}

// extractStr é um helper para ler string de map[string]interface{}
func extractStr(m map[string]interface{}, key string) (string, bool) {
	v, ok := m[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

// Garante que o formato de erro seja compatível com go-update
var _ = fmt.Sprintf
