package mqtt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	pahomqtt "github.com/eclipse/paho.mqtt.golang"
	"go.uber.org/zap"

	"github.com/sga-petro/agent/internal/commands"
	"github.com/sga-petro/agent/internal/config"
	"github.com/sga-petro/agent/internal/database"
	"github.com/sga-petro/agent/pkg/models"
)

// Beater é a interface mínima do watchdog (evita import circular).
type Beater interface{ Beat() }

// DiscoverRunner roda discovery sob demanda — recebido via MQTT DISCOVER_EMPRESAS.
type DiscoverRunner interface{ Run(ctx context.Context) }

// AgentClient gerencia a conexão MQTT e o despacho de comandos
type AgentClient struct {
	client        pahomqtt.Client
	cfg           config.MQTTConfig
	portal        config.PortalConfig
	agentID       string
	jwtToken      string
	versao        string
	cnpj          string
	cnpjClean     string // CNPJ sem pontuação para tópicos
	readHandler   *commands.ReadHandler
	writeHandler  *commands.WriteHandler
	updateHandler *commands.UpdateHandler
	cache         *database.CacheDB
	log           *zap.Logger
	done          chan struct{}
	httpClient    *http.Client
	watchdog      Beater          // opcional; recebe Beat() a cada heartbeat
	discoverer    DiscoverRunner  // opcional; chamado em DISCOVER_EMPRESAS MQTT
}

// SetWatchdog conecta um watchdog ao loop de heartbeat.
func (a *AgentClient) SetWatchdog(b Beater) { a.watchdog = b }

// SetDiscoverer conecta o discoverer (chamado em comando DISCOVER_EMPRESAS).
func (a *AgentClient) SetDiscoverer(d DiscoverRunner) { a.discoverer = d }

// NewAgentClient cria e configura o cliente MQTT
func NewAgentClient(
	cfg config.MQTTConfig,
	portal config.PortalConfig,
	agentID string,
	jwtToken string,
	versao string,
	cnpj string,
	readH *commands.ReadHandler,
	writeH *commands.WriteHandler,
	updateH *commands.UpdateHandler,
	cache *database.CacheDB,
	log *zap.Logger,
) *AgentClient {
	clean := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(cnpj, ".", ""), "/", ""), "-", "")
	return &AgentClient{
		cfg:           cfg,
		portal:        portal,
		agentID:       agentID,
		jwtToken:      jwtToken,
		versao:        versao,
		cnpj:          cnpj,
		cnpjClean:     clean,
		readHandler:   readH,
		writeHandler:  writeH,
		updateHandler: updateH,
		cache:         cache,
		log:           log,
		done:          make(chan struct{}),
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Connect estabelece a conexão MQTT e inicia o loop de heartbeat
func (a *AgentClient) Connect() error {
	opts := pahomqtt.NewClientOptions().
		AddBroker(a.cfg.Broker).
		SetClientID(a.cfg.ClientID).
		SetUsername(a.cfg.Username).
		SetPassword(a.cfg.Password).
		SetKeepAlive(time.Duration(a.cfg.KeepAliveSeconds) * time.Second).
		SetAutoReconnect(true).
		SetReconnectingHandler(func(_ pahomqtt.Client, _ *pahomqtt.ClientOptions) {
			a.log.Warn("MQTT reconectando...")
		}).
		SetOnConnectHandler(func(_ pahomqtt.Client) {
			a.log.Info("MQTT conectado", zap.String("broker", a.cfg.Broker))
			a.subscribeToTopics()
			a.publishStatus("online")
			go a.pingPortal("online")
		}).
		SetConnectionLostHandler(func(_ pahomqtt.Client, err error) {
			a.log.Warn("MQTT conexão perdida", zap.Error(err))
			a.publishStatus("offline")
		}).
		// Last Will: publica offline automaticamente se a conexão cair sem aviso
		SetWill(
			fmt.Sprintf("sga/%s/status", a.cnpjClean),
			`{"status":"offline","reason":"connection_lost"}`,
			1, true,
		)

	client := pahomqtt.NewClient(opts)
	token := client.Connect()
	token.Wait()
	if err := token.Error(); err != nil {
		return fmt.Errorf("conectando ao MQTT: %w", err)
	}

	a.client = client

	// Heartbeat a cada 60 segundos
	go a.heartbeatLoop()

	return nil
}

func (a *AgentClient) subscribeToTopics() {
	topics := map[string]byte{
		fmt.Sprintf("sga/%s/query",   a.cnpjClean): 1,
		fmt.Sprintf("sga/%s/command", a.cnpjClean): 1,
		fmt.Sprintf("sga/%s/config",  a.cnpjClean): 1,
	}
	token := a.client.SubscribeMultiple(topics, a.handleMessage)
	token.Wait()
	if err := token.Error(); err != nil {
		a.log.Error("erro ao assinar tópicos", zap.Error(err))
		return
	}
	a.log.Info("assinado", zap.Strings("topics", func() []string {
		var ts []string
		for t := range topics { ts = append(ts, t) }
		return ts
	}()))
}

func (a *AgentClient) handleMessage(_ pahomqtt.Client, msg pahomqtt.Message) {
	a.log.Debug("mensagem recebida",
		zap.String("topic", msg.Topic()),
		zap.Int("size_bytes", len(msg.Payload())),
	)

	var cmd models.MQTTCommand
	if err := json.Unmarshal(msg.Payload(), &cmd); err != nil {
		a.log.Error("payload inválido", zap.Error(err))
		return
	}

	// Processa em goroutine para não bloquear o receive loop do MQTT
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		_ = ctx

		var response []byte
		var err error

		switch cmd.Type {
		case models.CmdReadQuery:
			response, err = a.readHandler.Handle(&cmd)
		case models.CmdWriteCmd:
			response, err = a.writeHandler.Handle(&cmd)
		case models.CmdSyncTemplate:
			response, err = a.handleSyncTemplate(&cmd)
		case models.CmdUpdateAgent:
			// Roda em goroutine própria — bloqueia durante download + restart
			go a.updateHandler.Handle(&cmd)
			return
		case models.CmdDiscoverEmpresas:
			// Dispara descoberta on-demand (portal pediu).
			if a.discoverer != nil {
				go func() {
					dctx, dcancel := context.WithTimeout(context.Background(), 60*time.Second)
					defer dcancel()
					a.discoverer.Run(dctx)
				}()
			} else {
				a.log.Warn("DISCOVER_EMPRESAS recebido mas discoverer não configurado")
			}
			return
		default:
			a.log.Warn("tipo de comando desconhecido", zap.String("type", string(cmd.Type)))
			return
		}

		if err != nil {
			a.log.Error("erro processando comando", zap.Error(err))
			return
		}

		if response == nil {
			return
		}

		// Publica a resposta no tópico correto
		responseTopic := cmd.ResponseTopic
		if responseTopic == "" {
			responseTopic = fmt.Sprintf("sga/%s/result", a.cnpjClean)
		}
		a.publish(responseTopic, response, 1)
	}()
}

func (a *AgentClient) handleSyncTemplate(cmd *models.MQTTCommand) ([]byte, error) {
	if cmd.TemplateID == "" {
		return nil, nil
	}

	// O payload contém o metadata do template em JSON
	metadataBytes, err := json.Marshal(cmd.Payload)
	if err != nil {
		return nil, err
	}

	if err := a.cache.SaveTemplate(cmd.TemplateID, metadataBytes); err != nil {
		a.log.Error("erro salvando template", zap.String("id", cmd.TemplateID), zap.Error(err))
		return nil, err
	}

	a.log.Info("template sincronizado", zap.String("id", cmd.TemplateID))

	resp := map[string]interface{}{
		"type":       "SYNC_RESULT",
		"request_id": cmd.RequestID,
		"status":     "success",
		"timestamp":  time.Now().UnixMilli(),
	}
	return json.Marshal(resp)
}

func (a *AgentClient) publishStatus(status string) {
	topic := fmt.Sprintf("sga/%s/status", a.cnpjClean)
	payload, _ := json.Marshal(map[string]interface{}{
		"status":    status,
		"cnpj":      a.cnpj,
		"timestamp": time.Now().UnixMilli(),
		"version":   a.versao,
	})
	// retain=true: o broker guarda o último estado e entrega imediatamente
	// a qualquer subscriber novo — essencial para o PWA saber se o agente
	// está online sem esperar o próximo heartbeat (60s)
	a.Publish(topic, payload, 1, true)
}

func (a *AgentClient) heartbeatLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			a.publishStatus("online")
			a.pingPortal("online")
			if a.watchdog != nil {
				a.watchdog.Beat() // sinaliza vivo ao watchdog
			}
		case <-a.done:
			return
		}
	}
}

// PingPortalDirect é a versão exportada de pingPortal (usada por main.go em modo degraded).
func (a *AgentClient) PingPortalDirect(status string) { a.pingPortal(status) }

// StartDegradedHeartbeat inicia o loop de heartbeat REST sem MQTT.
// Usado quando a conexão MQTT falha mas queremos manter presença no portal.
func (a *AgentClient) StartDegradedHeartbeat() {
	go func() {
		a.pingPortal("online")
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				a.pingPortal("online")
			case <-a.done:
				return
			}
		}
	}()
}

// pingPortal chama POST /api/agent/heartbeat no portal para manter o status no DB.
// Falhas são apenas logadas — o agente continua funcionando normalmente.
func (a *AgentClient) pingPortal(status string) {
	if a.portal.URL == "" || a.jwtToken == "" {
		return
	}

	body, _ := json.Marshal(map[string]string{
		"agent_id": a.agentID,
		"versao":   a.versao,
		"status":   status,
	})

	url := strings.TrimRight(a.portal.URL, "/") + "/api/agent/heartbeat"
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		a.log.Warn("pingPortal: erro criando request", zap.Error(err))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.jwtToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		a.log.Warn("pingPortal: erro HTTP", zap.String("url", url), zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		a.log.Warn("pingPortal: resposta inesperada",
			zap.String("url", url),
			zap.Int("status", resp.StatusCode),
		)
		return
	}

	a.log.Debug("pingPortal: ok", zap.String("status", status))
}

func (a *AgentClient) publish(topic string, payload []byte, qos byte) {
	a.Publish(topic, payload, qos, false)
}

// Publish publica uma mensagem MQTT. retain=true retém a mensagem no broker.
// Usado por serviços externos (ex: DescontoService) sem acoplar ao cliente diretamente.
func (a *AgentClient) Publish(topic string, payload []byte, qos byte, retain bool) {
	if a.client == nil || !a.client.IsConnected() {
		a.log.Warn("MQTT desconectado — mensagem descartada", zap.String("topic", topic))
		return
	}
	token := a.client.Publish(topic, qos, retain, payload)
	token.Wait()
	if err := token.Error(); err != nil {
		a.log.Error("erro publicando", zap.String("topic", topic), zap.Error(err))
	}
}

// Disconnect encerra a conexão MQTT graciosamente
func (a *AgentClient) Disconnect() {
	close(a.done)
	if a.client != nil && a.client.IsConnected() {
		a.publishStatus("offline")
		a.client.Disconnect(2000)
	}
	a.pingPortal("offline")
	a.log.Info("MQTT desconectado")
}
