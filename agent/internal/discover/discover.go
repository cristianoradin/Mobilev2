// Package discover descobre empresas no banco local do cliente e reporta ao portal.
//
// Roda automaticamente:
//   - 1x no startup (após 30s pra estabilizar)
//   - a cada 6h
//   - sob demanda via comando MQTT DISCOVER_EMPRESAS
package discover

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/config"
	"github.com/sga-petro/agent/internal/database"
)

// Empresa descoberta no banco local
type Empresa struct {
	EmpCodigo int64  `json:"empcodigo"`
	EmpNome   string `json:"empnome"`
	EmpCnpj   string `json:"empcnpj,omitempty"`
}

type Discoverer struct {
	pg       *database.PostgresDB
	portal   config.PortalConfig
	agentID  string
	jwtToken string
	log      *zap.Logger
	client   *http.Client
}

func New(pg *database.PostgresDB, portal config.PortalConfig, agentID, jwt string, log *zap.Logger) *Discoverer {
	return &Discoverer{
		pg:       pg,
		portal:   portal,
		agentID:  agentID,
		jwtToken: jwt,
		log:      log,
		client:   &http.Client{Timeout: 15 * time.Second},
	}
}

// Query padrão — schema ERP SGA Petro. Customizável via config.json futuramente.
const DEFAULT_SQL = `
  SELECT empcodigo, empnome, COALESCE(empcnpj, '') AS empcnpj
  FROM emp
  WHERE COALESCE(empativo, 1) = 1
  ORDER BY empcodigo
  LIMIT 500
`

// Run roda discovery uma vez e reporta resultado ao portal.
func (d *Discoverer) Run(ctx context.Context) {
	if d.pg == nil {
		d.log.Warn("discover: PostgreSQL local indisponível — pulando")
		return
	}

	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	rows, err := d.pg.QueryContext(queryCtx, DEFAULT_SQL)
	if err != nil {
		d.log.Warn("discover: falha consultando empresas", zap.Error(err))
		return
	}

	empresas := make([]Empresa, 0, len(rows))
	for _, r := range rows {
		var emp Empresa
		switch v := r["empcodigo"].(type) {
		case int64:   emp.EmpCodigo = v
		case int:     emp.EmpCodigo = int64(v)
		case float64: emp.EmpCodigo = int64(v)
		}
		if s, ok := r["empnome"].(string); ok { emp.EmpNome = strings.TrimSpace(s) }
		if s, ok := r["empcnpj"].(string); ok { emp.EmpCnpj = strings.TrimSpace(s) }
		if emp.EmpCodigo > 0 && emp.EmpNome != "" {
			empresas = append(empresas, emp)
		}
	}

	d.log.Info("discover: empresas encontradas no banco local",
		zap.Int("count", len(empresas)))

	if err := d.report(ctx, empresas); err != nil {
		d.log.Warn("discover: falha reportando ao portal", zap.Error(err))
	}
}

// report POST /api/agent/empresas-discovered
func (d *Discoverer) report(ctx context.Context, empresas []Empresa) error {
	if d.portal.URL == "" || d.jwtToken == "" {
		return fmt.Errorf("portal.url ou jwt vazio")
	}

	payload := map[string]interface{}{
		"agent_id": d.agentID,
		"empresas": empresas,
	}
	body, _ := json.Marshal(payload)

	url := strings.TrimRight(d.portal.URL, "/") + "/api/agent/empresas-discovered"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+d.jwtToken)

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("portal respondeu %d", resp.StatusCode)
	}

	d.log.Info("discover: reportado ao portal", zap.Int("count", len(empresas)))
	return nil
}

// Start agenda discovery automático: 30s após boot + a cada 6h.
func (d *Discoverer) Start(ctx context.Context) {
	go func() {
		// Primeira run com delay pra agente estabilizar PG/MQTT
		initial := time.NewTimer(30 * time.Second)
		defer initial.Stop()

		select {
		case <-ctx.Done():
			return
		case <-initial.C:
		}
		d.Run(ctx)

		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				d.Run(ctx)
			}
		}
	}()

	d.log.Info("discover: scheduler ativo (1x startup + 6h)")
}
