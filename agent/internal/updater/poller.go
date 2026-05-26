// Package updater faz polling periódico de novas versões no portal e
// aplica auto-update via UpdateHandler. Garante que o agente atualize
// mesmo após ter perdido a janela do comando MQTT push (offline na hora).
package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/commands"
)

// LatestRelease é o formato do /agent/latest.json do portal.
type LatestRelease struct {
	Version    string `json:"version"`     // ex: "1.1.3"
	SHA256     string `json:"sha256"`      // hex
	URL        string `json:"url"`         // pode ser relativa (ex: "/agent/sga-agent.exe") ou absoluta
	ReleasedAt string `json:"released_at"` // ISO 8601
	Notes      string `json:"notes"`
}

type Poller struct {
	portalURL string
	updater   *commands.UpdateHandler
	interval  time.Duration
	log       *zap.Logger
	client    *http.Client
}

// New cria um poller. interval mínimo: 5min (evita amplificação se algo bugado).
func New(portalURL string, updater *commands.UpdateHandler, interval time.Duration, log *zap.Logger) *Poller {
	if interval < 5*time.Minute {
		interval = 5 * time.Minute
	}
	return &Poller{
		portalURL: strings.TrimRight(portalURL, "/"),
		updater:   updater,
		interval:  interval,
		log:       log,
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

// Start roda o loop em goroutine. Encerra quando ctx for cancelado.
// Primeira verificação acontece após 1min (dá tempo do agente estabilizar).
func (p *Poller) Start(ctx context.Context) {
	if p.portalURL == "" {
		p.log.Warn("update-poller: portal.url vazio — desativado")
		return
	}

	go func() {
		// Atraso inicial pra evitar bater no portal logo no boot
		initial := time.NewTimer(1 * time.Minute)
		defer initial.Stop()

		select {
		case <-ctx.Done():
			return
		case <-initial.C:
		}

		p.checkOnce(ctx)

		ticker := time.NewTicker(p.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				p.log.Info("update-poller: encerrando")
				return
			case <-ticker.C:
				p.checkOnce(ctx)
			}
		}
	}()

	p.log.Info("update-poller: ativo",
		zap.Duration("intervalo", p.interval),
		zap.String("portal", p.portalURL),
	)
}

func (p *Poller) checkOnce(ctx context.Context) {
	releaseURL := p.portalURL + "/agent/latest.json"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releaseURL, nil)
	if err != nil {
		p.log.Warn("update-poller: erro criando request", zap.Error(err))
		return
	}

	resp, err := p.client.Do(req)
	if err != nil {
		p.log.Warn("update-poller: falha buscando latest.json", zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		p.log.Warn("update-poller: status inesperado", zap.Int("http", resp.StatusCode))
		return
	}

	var rel LatestRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		p.log.Warn("update-poller: latest.json inválido", zap.Error(err))
		return
	}

	if rel.Version == "" || rel.SHA256 == "" || rel.URL == "" {
		p.log.Warn("update-poller: latest.json incompleto", zap.Any("rel", rel))
		return
	}

	if !isNewer(rel.Version, p.updater.CurrentVersion()) {
		p.log.Debug("update-poller: já na versão mais nova",
			zap.String("corrente", p.updater.CurrentVersion()),
			zap.String("latest", rel.Version),
		)
		return
	}

	// Resolve URL relativa → absoluta usando portal como base
	absURL := rel.URL
	if !strings.HasPrefix(absURL, "http://") && !strings.HasPrefix(absURL, "https://") {
		base, _ := url.Parse(p.portalURL)
		ref, _ := url.Parse(absURL)
		if base != nil && ref != nil {
			absURL = base.ResolveReference(ref).String()
		}
	}

	p.log.Info("update-poller: nova versão disponível — aplicando",
		zap.String("corrente", p.updater.CurrentVersion()),
		zap.String("nova", rel.Version),
		zap.String("url", absURL),
	)

	if err := p.updater.ApplyUpdate(rel.Version, absURL, rel.SHA256); err != nil {
		p.log.Warn("update-poller: ApplyUpdate falhou", zap.Error(err))
	}
}

// isNewer compara versões "X.Y.Z" — retorna true se a > b.
// Versões malformadas comparam como strings.
func isNewer(a, b string) bool {
	pa, oka := parseVer(a)
	pb, okb := parseVer(b)
	if !oka || !okb {
		return a > b
	}
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			return pa[i] > pb[i]
		}
	}
	return false
}

func parseVer(v string) ([3]int, bool) {
	var out [3]int
	parts := strings.SplitN(v, ".", 3)
	if len(parts) != 3 {
		return out, false
	}
	for i, p := range parts {
		var n int
		if _, err := fmt.Sscanf(p, "%d", &n); err != nil {
			return out, false
		}
		out[i] = n
	}
	return out, true
}
