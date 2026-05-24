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

// Handle processa um MQTTCommand do tipo UPDATE_AGENT.
// Os campos esperados em cmd.Payload:
//
//	"version" string  — versão nova (ex: "1.1.0")
//	"url"     string  — URL pública para baixar o novo executável
//	"sha256"  string  — hash SHA-256 hex esperado do binário
//	"secret"  string  — deve ser igual ao PUSH_SECRET configurado no agente
func (h *UpdateHandler) Handle(cmd *models.MQTTCommand) {
	// ── 1. Extrai campos do payload ──────────────────────────────────────────
	secret, _ := cmd.Payload["secret"].(string)
	newVersion, _ := cmd.Payload["version"].(string)
	downloadURL, _ := cmd.Payload["url"].(string)
	expectedHash, _ := cmd.Payload["sha256"].(string)

	// ── 2. Autorização: verifica secret ─────────────────────────────────────
	if h.pushSecret == "" || secret != h.pushSecret {
		h.log.Warn("UPDATE_AGENT: secret inválido — comando ignorado")
		return
	}

	if downloadURL == "" || expectedHash == "" || newVersion == "" {
		h.log.Warn("UPDATE_AGENT: campos obrigatórios ausentes (version, url, sha256)")
		return
	}

	h.log.Info("UPDATE_AGENT: iniciando atualização",
		zap.String("versao_atual", h.version),
		zap.String("versao_nova", newVersion),
		zap.String("url", downloadURL),
	)

	// ── 3. Download ──────────────────────────────────────────────────────────
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(downloadURL)
	if err != nil {
		h.log.Error("UPDATE_AGENT: falha no download", zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		h.log.Error("UPDATE_AGENT: download retornou status inesperado",
			zap.Int("status", resp.StatusCode))
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.log.Error("UPDATE_AGENT: erro lendo resposta do download", zap.Error(err))
		return
	}

	h.log.Info("UPDATE_AGENT: download concluído", zap.Int("bytes", len(body)))

	// ── 4. Verifica SHA256 ───────────────────────────────────────────────────
	sum := sha256.Sum256(body)
	got := hex.EncodeToString(sum[:])
	if got != expectedHash {
		h.log.Error("UPDATE_AGENT: SHA256 não confere — abortando",
			zap.String("esperado", expectedHash),
			zap.String("recebido", got),
		)
		return
	}

	h.log.Info("UPDATE_AGENT: SHA256 verificado", zap.String("sha256", got))

	// ── 5. Substituição atômica do binário ───────────────────────────────────
	// go-update escreve o novo exe de forma atômica, lidando com o bloqueio
	// de arquivo do Windows (move current→.old, escreve novo→current).
	if err := update.Apply(bytes.NewReader(body), update.Options{}); err != nil {
		h.log.Error("UPDATE_AGENT: falha ao aplicar atualização", zap.Error(err))
		// Tenta rollback se o go-update deixou o arquivo parcialmente escrito
		if rbErr := update.RollbackError(err); rbErr != nil {
			h.log.Error("UPDATE_AGENT: rollback também falhou", zap.Error(rbErr))
		}
		return
	}

	h.log.Info("UPDATE_AGENT: binário substituído com sucesso — reiniciando serviço",
		zap.String("versao_nova", newVersion),
	)

	// ── 6. Dispara restart ───────────────────────────────────────────────────
	if h.onApplied != nil {
		h.onApplied()
	}
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
