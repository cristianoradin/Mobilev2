// Package watchdog detecta travamentos vivos do agente.
//
// O serviço Windows reinicia em CRASH (OnFailure=restart), mas se uma
// goroutine entra em deadlock ou loop infinito, o processo continua "vivo"
// na visão do SCM — nada reinicia. O watchdog resolve isso:
//
//   1. O loop principal chama Beat() periodicamente (heartbeat).
//   2. Uma goroutine separada verifica se Beat() foi chamado dentro do timeout.
//   3. Se passou do timeout sem Beat(), assume travamento e força os.Exit(2).
//   4. O SCM reinicia o serviço (graças ao OnFailure=restart).
//
// Também expõe Healthy() para um endpoint HTTP /healthz consumido por
// monitores externos (NSSM, agendador do PDV, etc).
package watchdog

import (
	"context"
	"os"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

type Watchdog struct {
	timeout time.Duration
	lastBeat atomic.Int64 // unix nano do último beat
	log      *zap.Logger
}

// New cria um watchdog. timeout mínimo: 1min.
func New(timeout time.Duration, log *zap.Logger) *Watchdog {
	if timeout < time.Minute {
		timeout = time.Minute
	}
	w := &Watchdog{timeout: timeout, log: log}
	w.Beat() // marca o boot como "vivo"
	return w
}

// Beat registra que o processo ainda está respondendo. Chame periodicamente
// do loop principal (heartbeat do MQTT é uma posição natural).
func (w *Watchdog) Beat() {
	w.lastBeat.Store(time.Now().UnixNano())
}

// LastBeatAge retorna quanto tempo passou desde o último Beat.
func (w *Watchdog) LastBeatAge() time.Duration {
	return time.Since(time.Unix(0, w.lastBeat.Load()))
}

// Healthy retorna true se o último Beat foi dentro do timeout.
// Usado pelo endpoint HTTP /healthz.
func (w *Watchdog) Healthy() bool {
	return w.LastBeatAge() < w.timeout
}

// Start roda o loop de verificação. Encerra com ctx cancelado.
// Se detectar travamento, loga + os.Exit(2) — Windows SCM/systemd reinicia.
func (w *Watchdog) Start(ctx context.Context) {
	// Verifica a cada 1/4 do timeout (mínimo 30s)
	interval := w.timeout / 4
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				age := w.LastBeatAge()
				if age > w.timeout {
					w.log.Error("WATCHDOG: TRAVAMENTO DETECTADO — forçando restart",
						zap.Duration("ultimo_beat_age", age),
						zap.Duration("timeout", w.timeout),
					)
					_ = w.log.Sync()
					// Exit code 2 = travamento (≠ 0 normal, ≠ 1 update). O service manager reinicia.
					os.Exit(2)
				}
			}
		}
	}()

	w.log.Info("watchdog: ativo",
		zap.Duration("timeout", w.timeout),
		zap.Duration("check_interval", interval),
	)
}
