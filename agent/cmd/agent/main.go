package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"

	"github.com/kardianos/service"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"

	"github.com/sga-petro/agent/internal/auth"
	"github.com/sga-petro/agent/internal/commands"
	"github.com/sga-petro/agent/internal/config"
	"github.com/sga-petro/agent/internal/database"
	"github.com/sga-petro/agent/internal/discount"
	"github.com/sga-petro/agent/internal/discover"
	"github.com/sga-petro/agent/internal/httpserver"
	"github.com/sga-petro/agent/internal/mqtt"
	"github.com/sga-petro/agent/internal/query"
	"github.com/sga-petro/agent/internal/setup"
	"github.com/sga-petro/agent/internal/updater"
	"github.com/sga-petro/agent/internal/watchdog"
)

// svcRef é um singleton para que o UpdateHandler possa reiniciar o serviço
// sem acoplar ao program struct diretamente.
var svcRef service.Service

// exeDir retorna o diretório onde o executável está — funciona em Windows Service
// (onde o working directory pode ser System32 ou outro caminho inesperado)
func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

// resolvePath torna um caminho relativo absoluto em relação ao diretório do exe
func resolvePath(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(exeDir(), p)
}

const version = "1.2.1"

// program implementa service.Interface para rodar como Windows Service / Systemd
type program struct {
	cfg        *config.Config
	agent      *mqtt.AgentClient
	httpServer *httpserver.Server
	pg         *database.PostgresDB
	cache      *database.CacheDB
	log        *zap.Logger
	wd         *watchdog.Watchdog
	cancel     context.CancelFunc
}

func (p *program) Start(s service.Service) error {
	p.log.Info("SGA Petro Agent iniciando", zap.String("version", version))

	// 0. Panic recovery global — captura panic em qualquer goroutine raiz
	//    e loga stacktrace antes de morrer. O service manager reinicia em seguida.
	defer func() {
		if r := recover(); r != nil {
			p.log.Error("PANIC no Start",
				zap.Any("recover", r),
				zap.String("stack", string(debug.Stack())),
			)
			_ = p.log.Sync()
			os.Exit(2)
		}
	}()

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
	executor := query.NewExecutorWithLogger(pg, cache, agentClaims.CNPJ, p.log)
	readHandler  := commands.NewReadHandler(executor, cache, validator, p.log)
	writeHandler := commands.NewWriteHandler(pg, cache, validator, agentClaims.CNPJ, p.log)

	// UpdateHandler: após substituir o binário, reinicia o serviço Windows/Systemd.
	// O serviço está configurado com OnFailure=restart, então os.Exit(1) é suficiente.
	updateHandler := commands.NewUpdateHandler(
		p.cfg.Portal.PushSecret,
		version,
		func() {
			p.log.Info("UPDATE_AGENT: acionando restart do serviço...")
			_ = p.log.Sync()
			if svcRef != nil {
				// Tenta restart via service manager (mais limpo)
				if err := service.Control(svcRef, "restart"); err != nil {
					// Fallback: encerra o processo — o Windows Service Manager reinicia
					p.log.Warn("restart via service manager falhou, usando os.Exit(1)", zap.Error(err))
					os.Exit(1)
				}
			} else {
				os.Exit(1)
			}
		},
		p.log,
	)

	// 5. Conecta ao MQTT e começa a escutar comandos
	// Credenciais padrão: username = CNPJ limpo, password = JWT do agente.
	// Isso permite que o EMQX valide via JWT (RS256) e aplique ACL por CNPJ.
	// Agentes antigos (config.json sem username/password) são migrados automaticamente.
	mqttCfg := p.cfg.MQTT
	if mqttCfg.Username == "" {
		mqttCfg.Username = strings.NewReplacer(".", "", "/", "", "-", "").Replace(agentClaims.CNPJ)
	}
	if mqttCfg.Password == "" {
		mqttCfg.Password = p.cfg.JWTToken
	}

	agentClient := mqtt.NewAgentClient(
		mqttCfg,
		p.cfg.Portal,
		p.cfg.AgentID,
		p.cfg.JWTToken,
		version,
		agentClaims.CNPJ,
		readHandler,
		writeHandler,
		updateHandler,
		cache,
		p.log,
	)

	if err := agentClient.Connect(); err != nil {
		// MQTT falhou — modo degraded: inicia heartbeat REST para ao menos aparecer no portal
		p.log.Warn("MQTT não conectou — modo degraded (só REST)", zap.Error(err))
		agentClient.StartDegradedHeartbeat()
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

	// 7. Watchdog — detecta travamentos vivos (deadlock, goroutine bloqueada).
	//    Beat() é chamado pelo heartbeat do MQTT e por um ticker próprio.
	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel
	if p.cfg.Watchdog.Enabled {
		p.wd = watchdog.New(time.Duration(p.cfg.Watchdog.TimeoutMinutes)*time.Minute, p.log)
		p.wd.Start(ctx)
		// Beat periódico independente do MQTT — garante que mesmo se MQTT travar,
		// o watchdog só dispara quando outras goroutines também travarem.
		// O loop principal do MQTT também chama Beat() em seu heartbeat.
		agentClient.SetWatchdog(p.wd)
	}

	// 8. HTTP local (PDV) — expõe /healthz com estado do watchdog
	var probe httpserver.LivenessProbe
	if p.wd != nil { probe = p.wd }
	httpSrv := httpserver.New(p.cfg.HTTP.Port, descontoSvc, probe, version, p.log)
	if err := httpSrv.Start(); err != nil {
		// Não falha hard — o agente continua funcionando sem o HTTP local
		p.log.Warn("servidor HTTP local não iniciado", zap.Error(err))
	} else {
		p.httpServer = httpSrv
	}

	// 9. Poller de updates — verifica /agent/latest.json periodicamente
	if p.cfg.Update.Enabled {
		poller := updater.New(
			p.cfg.Portal.URL,
			updateHandler,
			time.Duration(p.cfg.Update.PollIntervalMinutes)*time.Minute,
			p.log,
		)
		poller.Start(ctx)
	}

	// 9b. Discoverer — descobre empresas no banco local + reporta ao portal.
	//     Roda 30s após boot e a cada 6h. Disparável on-demand via MQTT command.
	disc := discover.New(pg, p.cfg.Portal, p.cfg.AgentID, p.cfg.JWTToken, p.log)
	disc.Start(ctx)
	agentClient.SetDiscoverer(disc)

	// 10. Agenda vacuum periódico do SQLite
	go func() {
		defer func() {
			if r := recover(); r != nil {
				p.log.Error("PANIC no vacuum loop",
					zap.Any("recover", r),
					zap.String("stack", string(debug.Stack())),
				)
			}
		}()
		interval := time.Duration(p.cfg.Cache.VacuumIntervalHours) * time.Hour
		if p.cfg.Cache.VacuumIntervalHours == 0 {
			interval = 24 * time.Hour
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := cache.Vacuum(); err != nil {
					p.log.Error("erro no vacuum", zap.Error(err))
				}
			}
		}
	}()

	p.log.Info("SGA Petro Agent ativo",
		zap.String("cnpj", agentClaims.CNPJ),
		zap.String("broker", p.cfg.MQTT.Broker),
		zap.Int("http_port", p.cfg.HTTP.Port),
		zap.Bool("watchdog", p.cfg.Watchdog.Enabled),
		zap.Bool("update_poller", p.cfg.Update.Enabled),
	)

	return nil
}

func (p *program) Stop(_ service.Service) error {
	p.log.Info("SGA Petro Agent encerrando...")

	if p.cancel != nil {
		p.cancel()
	}
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
	// ── Subcomando setup — deve ser tratado ANTES de carregar config.json ──────
	// (config.json ainda não existe na máquina do cliente)
	if len(os.Args) > 1 && os.Args[1] == "setup" {
		token := ""
		args := os.Args[2:]
		for i, a := range args {
			if a == "--token" || a == "-token" {
				if i+1 < len(args) {
					token = args[i+1]
				}
			} else if !strings.HasPrefix(a, "-") {
				token = a
			}
		}
		if token == "" {
			fmt.Fprintln(os.Stderr, "Uso: sga-agent.exe setup <TOKEN>")
			fmt.Fprintln(os.Stderr, "O token é gerado no portal em Clientes → Instalador.")
			os.Exit(1)
		}
		setup.Run(token)
		return
	}

	// Determina o arquivo de config (argumento ou padrão relativo ao exe)
	cfgPath := resolvePath("config.json")
	if len(os.Args) > 1 && os.Args[1] != "install" && os.Args[1] != "uninstall" && os.Args[1] != "start" && os.Args[1] != "stop" {
		cfgPath = os.Args[1]
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("ERRO ao carregar configuração: %v\n\nCrie um config.json baseado no config.example.json", err)
	}

	// Resolve caminhos relativos em relação ao diretório do executável
	cfg.Log.Path   = resolvePath(cfg.Log.Path)
	cfg.Cache.Path = resolvePath(cfg.Cache.Path)

	logger := buildLogger(cfg.Log)
	defer logger.Sync() //nolint:errcheck

	svcConfig := &service.Config{
		Name:        "SGAPetroAgent",
		DisplayName: "SGA Petro — Agente Local",
		Description: "Serviço de integração analytics para postos de combustível SGA Petro v" + version,
		// Windows: reinicia automaticamente após 2 s em qualquer saída não-zero.
		// Isso garante que o serviço suba novamente após um self-update (os.Exit(1)).
		Option: service.KeyValue{
			"OnFailure":              "restart",
			"OnFailureDelayDuration": "2s",
			"OnFailureResetPeriod":   60,
		},
	}

	prg := &program{cfg: cfg, log: logger}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		log.Fatalf("criando serviço: %v", err)
	}
	svcRef = s // expõe para o UpdateHandler reiniciar via service manager

	// Suporte a comandos de gerenciamento: install, uninstall, start, stop, setup
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

func buildLogger(cfgLog config.LogConfig) *zap.Logger {
	lvl := zapcore.InfoLevel
	switch cfgLog.Level {
	case "debug":
		lvl = zapcore.DebugLevel
	case "warn":
		lvl = zapcore.WarnLevel
	case "error":
		lvl = zapcore.ErrorLevel
	}

	encCfg := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		MessageKey:     "msg",
		CallerKey:      "caller",
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
	}
	encoder := zapcore.NewJSONEncoder(encCfg)

	// File output via lumberjack (rotação automática)
	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   cfgLog.Path,
		MaxSize:    cfgLog.MaxSizeMB,
		MaxBackups: cfgLog.MaxBackups,
		MaxAge:     30,    // dias — limita backups antigos
		Compress:   true,  // gzip nos rotacionados
	})

	stdoutWriter := zapcore.AddSync(os.Stdout)

	core := zapcore.NewTee(
		zapcore.NewCore(encoder, fileWriter,   lvl),
		zapcore.NewCore(encoder, stdoutWriter, lvl),
	)

	return zap.New(core, zap.AddCaller(), zap.ErrorOutput(zapcore.AddSync(os.Stderr)))
}
