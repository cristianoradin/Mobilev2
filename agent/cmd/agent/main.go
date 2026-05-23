package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/kardianos/service"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/sga-petro/agent/internal/auth"
	"github.com/sga-petro/agent/internal/commands"
	"github.com/sga-petro/agent/internal/config"
	"github.com/sga-petro/agent/internal/database"
	"github.com/sga-petro/agent/internal/discount"
	"github.com/sga-petro/agent/internal/httpserver"
	"github.com/sga-petro/agent/internal/mqtt"
	"github.com/sga-petro/agent/internal/query"
)

const version = "1.0.0"

// program implementa service.Interface para rodar como Windows Service / Systemd
type program struct {
	cfg        *config.Config
	agent      *mqtt.AgentClient
	httpServer *httpserver.Server
	pg         *database.PostgresDB
	cache      *database.CacheDB
	log        *zap.Logger
}

func (p *program) Start(s service.Service) error {
	p.log.Info("SGA Petro Agent iniciando", zap.String("version", version))

	// 1. Valida JWT do agente — falha hard se inválido ou expirado
	validator, err := auth.NewValidator()
	if err != nil {
		return fmt.Errorf("criando validador JWT: %w", err)
	}

	agentClaims, err := validator.ValidateAgentJWT(p.cfg.JWTToken)
	if err != nil {
		return fmt.Errorf("JWT do agente inválido: %w — verifique o token em config.json", err)
	}

	p.log.Info("JWT validado",
		zap.String("cnpj", agentClaims.CNPJ),
		zap.String("plano", agentClaims.Plano),
		zap.Int("empresas", len(agentClaims.Empresas)),
	)

	// 2. Abre banco SQLite de cache
	cache, err := database.NewCacheDB(p.cfg.Cache.Path)
	if err != nil {
		return fmt.Errorf("abrindo cache SQLite: %w", err)
	}
	p.cache = cache

	// 3. Conecta ao PostgreSQL local do cliente
	pg, err := database.NewPostgresDB(p.cfg.Database)
	if err != nil {
		// Não falha hard — opera em modo cache-only se banco local estiver indisponível
		p.log.Warn("PostgreSQL local indisponível — modo cache-only", zap.Error(err))
	} else {
		p.log.Info("PostgreSQL local conectado",
			zap.String("host", p.cfg.Database.Host),
			zap.String("db", p.cfg.Database.Name),
		)
	}
	p.pg = pg

	// 4. Monta os handlers de comando
	executor := query.NewExecutor(pg, cache, agentClaims.CNPJ)
	readHandler := commands.NewReadHandler(executor, cache, validator, p.log)
	writeHandler := commands.NewWriteHandler(pg, cache, validator, agentClaims.CNPJ, p.log)

	// 5. Conecta ao MQTT e começa a escutar comandos
	agentClient := mqtt.NewAgentClient(
		p.cfg.MQTT,
		agentClaims.CNPJ,
		readHandler,
		writeHandler,
		cache,
		p.log,
	)

	if err := agentClient.Connect(); err != nil {
		return fmt.Errorf("conectando ao MQTT: %w", err)
	}
	p.agent = agentClient

	// 6. Serviço de desconto + servidor HTTP local para o PDV
	cnpjFmt  := agentClaims.CNPJ
	cnpjClean := strings.NewReplacer(".", "", "/", "", "-", "").Replace(cnpjFmt)

	descontoSvc := discount.New(
		agentClient.Publish,
		cnpjClean,
		cnpjFmt,
		p.cfg.Portal.URL,
		p.cfg.Portal.PushSecret,
		p.log,
	)

	httpSrv := httpserver.New(p.cfg.HTTP.Port, descontoSvc, p.log)
	if err := httpSrv.Start(); err != nil {
		// Não falha hard — o agente continua funcionando sem o HTTP local
		p.log.Warn("servidor HTTP local não iniciado", zap.Error(err))
	} else {
		p.httpServer = httpSrv
	}

	// 7. Agenda vacuum periódico do SQLite
	go func() {
		ticker := time.NewTicker(time.Duration(p.cfg.Cache.VacuumIntervalHours) * time.Hour)
		if p.cfg.Cache.VacuumIntervalHours == 0 {
			ticker = time.NewTicker(24 * time.Hour)
		}
		defer ticker.Stop()
		for range ticker.C {
			if err := cache.Vacuum(); err != nil {
				p.log.Error("erro no vacuum", zap.Error(err))
			}
		}
	}()

	p.log.Info("SGA Petro Agent ativo",
		zap.String("cnpj", agentClaims.CNPJ),
		zap.String("broker", p.cfg.MQTT.Broker),
		zap.Int("http_port", p.cfg.HTTP.Port),
	)

	return nil
}

func (p *program) Stop(_ service.Service) error {
	p.log.Info("SGA Petro Agent encerrando...")

	if p.httpServer != nil {
		p.httpServer.Shutdown()
	}
	if p.agent != nil {
		p.agent.Disconnect()
	}
	if p.pg != nil {
		p.pg.Close()
	}
	if p.cache != nil {
		p.cache.Close()
	}

	p.log.Info("SGA Petro Agent encerrado")
	_ = p.log.Sync()
	return nil
}

func main() {
	// Determina o arquivo de config (argumento ou padrão)
	cfgPath := "config.json"
	if len(os.Args) > 1 && os.Args[1] != "install" && os.Args[1] != "uninstall" && os.Args[1] != "start" && os.Args[1] != "stop" {
		cfgPath = os.Args[1]
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("ERRO ao carregar configuração: %v\n\nCrie um config.json baseado no config.example.json", err)
	}

	logger := buildLogger(cfg.Log.Level)
	defer logger.Sync() //nolint:errcheck

	svcConfig := &service.Config{
		Name:        "SGAPetroAgent",
		DisplayName: "SGA Petro — Agente Local",
		Description: "Serviço de integração analytics para postos de combustível SGA Petro v" + version,
	}

	prg := &program{cfg: cfg, log: logger}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		log.Fatalf("criando serviço: %v", err)
	}

	// Suporte a comandos de gerenciamento: install, uninstall, start, stop
	if len(os.Args) > 1 {
		cmd := os.Args[1]
		switch cmd {
		case "install", "uninstall", "start", "stop":
			if err := service.Control(s, cmd); err != nil {
				log.Fatalf("controlando serviço (%s): %v", cmd, err)
			}
			fmt.Printf("Serviço %s executado com sucesso.\n", cmd)
			return
		}
	}

	if err := s.Run(); err != nil {
		log.Fatalf("executando serviço: %v", err)
	}
}

func buildLogger(level string) *zap.Logger {
	lvl := zapcore.InfoLevel
	switch level {
	case "debug":
		lvl = zapcore.DebugLevel
	case "warn":
		lvl = zapcore.WarnLevel
	case "error":
		lvl = zapcore.ErrorLevel
	}

	cfg := zap.Config{
		Level:       zap.NewAtomicLevelAt(lvl),
		Development: false,
		Encoding:    "json",
		EncoderConfig: zapcore.EncoderConfig{
			TimeKey:        "ts",
			LevelKey:       "level",
			MessageKey:     "msg",
			CallerKey:      "caller",
			EncodeLevel:    zapcore.LowercaseLevelEncoder,
			EncodeTime:     zapcore.ISO8601TimeEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
			EncodeDuration: zapcore.StringDurationEncoder,
		},
		OutputPaths:      []string{"stdout", "./agent.log"},
		ErrorOutputPaths: []string{"stderr"},
	}

	logger, err := cfg.Build()
	if err != nil {
		log.Fatalf("criando logger: %v", err)
	}
	return logger
}
