// Package httpserver expõe uma API HTTP local para o software de PDV.
//
// O servidor escuta em 127.0.0.1:{port} — não é acessível externamente.
// Endpoints:
//
//	GET  /health                    — liveness check
//	POST /api/desconto/request      — PDV solicita autorização de desconto
package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/discount"
)

// LivenessProbe é uma interface mínima que algo (ex: watchdog) pode implementar
// para responder /healthz com estado real do processo (não só "porta aberta").
type LivenessProbe interface {
	Healthy() bool
	LastBeatAge() time.Duration
}

// Server é o servidor HTTP local do agente.
type Server struct {
	srv      *http.Server
	desconto *discount.DescontoService
	probe    LivenessProbe // pode ser nil — /healthz responde só "ok"
	version  string
	log      *zap.Logger
}

// New cria o servidor HTTP local na porta informada.
// Passe probe=nil se não tiver watchdog ainda — /healthz vira só ping.
func New(port int, descontoSvc *discount.DescontoService, probe LivenessProbe, version string, log *zap.Logger) *Server {
	s := &Server{desconto: descontoSvc, probe: probe, version: version, log: log}

	mux := http.NewServeMux()
	mux.HandleFunc("/health",               s.handleHealth)
	mux.HandleFunc("/healthz",              s.handleHealthz)
	mux.HandleFunc("/api/desconto/request", s.handleDescontoRequest)

	s.srv = &http.Server{
		Addr:         fmt.Sprintf("127.0.0.1:%d", port),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	return s
}

// Start inicia o servidor em background. Bloqueia até estar pronto.
func (s *Server) Start() error {
	ln, err := net.Listen("tcp", s.srv.Addr)
	if err != nil {
		return fmt.Errorf("abrindo porta HTTP %s: %w", s.srv.Addr, err)
	}

	go func() {
		s.log.Info("HTTP local ativo", zap.String("addr", s.srv.Addr))
		if err := s.srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			s.log.Error("HTTP server encerrou com erro", zap.Error(err))
		}
	}()
	return nil
}

// Shutdown encerra o servidor graciosamente.
func (s *Server) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = s.srv.Shutdown(ctx)
	s.log.Info("HTTP local encerrado")
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

// handleHealthz é a versão "deep" com status do watchdog. Retorna 503 se travado.
func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	type out struct {
		Status       string `json:"status"`
		Version      string `json:"version"`
		LastBeatAge  string `json:"last_beat_age,omitempty"`
	}
	r := out{Status: "ok", Version: s.version}
	if s.probe != nil {
		r.LastBeatAge = s.probe.LastBeatAge().Round(time.Second).String()
		if !s.probe.Healthy() {
			r.Status = "unhealthy"
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(r)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(r)
}

func (s *Server) handleDescontoRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
		return
	}

	var input discount.SolicitacaoInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "body inválido: " + err.Error(),
		})
		return
	}

	notifID, err := s.desconto.NotificarDesconto(input)
	if err != nil {
		s.log.Warn("erro ao processar solicitação de desconto", zap.Error(err))
		s.writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
		return
	}

	s.writeJSON(w, http.StatusCreated, map[string]string{
		"ok":              "true",
		"notification_id": notifID,
	})
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
