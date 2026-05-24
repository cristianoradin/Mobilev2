package setup

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	installDir  = `C:\SGA-Petro`
	serviceName = "SGAPetroAgent"
	exeName     = "sga-agent.exe"
)

// cores ANSI
const (
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
	colorCyan   = "\033[36m"
	colorBold   = "\033[1m"
	colorDim    = "\033[2m"
)

func green(s string) string  { return colorGreen + s + colorReset }
func yellow(s string) string { return colorYellow + s + colorReset }
func red(s string) string    { return colorRed + s + colorReset }
func cyan(s string) string   { return colorCyan + s + colorReset }
func bold(s string) string   { return colorBold + s + colorReset }
func dim(s string) string    { return colorDim + s + colorReset }

// Run executa o assistente de instalação completo.
// tokenRaw é o conteúdo do --token passado na linha de comando.
func Run(tokenRaw string) {
	enableWindowsANSI()

	printBanner()

	// ── Decodifica token ─────────────────────────────────────────────────────
	printStep(0, 0, "Validando token de ativação...")
	tok, err := Decode(tokenRaw)
	if err != nil {
		fatal("Token inválido: %v\n\nVerifique o token gerado no portal.", err)
	}

	// Extrai informações do JWT para exibição (sem verificar assinatura — só decodifica)
	cnpj, clienteNome := extractJWTInfo(tok.JWT, tok.ClienteNome)
	plano := extractPlano(tok.JWT)

	fmt.Printf("  %s Token validado\n", green("✓"))
	fmt.Printf("  %s: %s\n", dim("Cliente"), bold(clienteNome))
	fmt.Printf("  %s: %s\n", dim("CNPJ   "), bold(cnpj))
	fmt.Printf("  %s: %s\n\n", dim("Plano  "), bold(plano))

	// ── Pré-requisitos ───────────────────────────────────────────────────────
	stepHeader(1, 5, "Verificando pré-requisitos")
	checkPrereqs()

	// ── Banco de dados ───────────────────────────────────────────────────────
	stepHeader(2, 5, "Localizando banco de dados")
	dbHost, dbPort, dbName, dbUser, dbPass := discoverDB(tok)

	// ── Configura arquivos ───────────────────────────────────────────────────
	stepHeader(3, 5, "Configurando agente")
	agentID := uuid.New().String()
	configPath := writeConfig(tok, agentID, cnpj, dbHost, dbPort, dbName, dbUser, dbPass)
	fmt.Printf("  %s Configuração salva em %s\n", green("✓"), dim(configPath))

	// ── Serviço Windows ───────────────────────────────────────────────────────
	stepHeader(4, 5, "Instalando serviço Windows")
	installService()

	// ── Verificação final ─────────────────────────────────────────────────────
	stepHeader(5, 5, "Verificando conectividade")
	verifyRunning()

	printSuccess(clienteNome, cnpj)
}

// ── Detecção do banco ─────────────────────────────────────────────────────────

func discoverDB(tok *SetupToken) (host string, port int, name, user, pass string) {
	// Defaults do token
	host = "localhost"
	port = 5432
	name = tok.DB.Name
	user = tok.DB.User
	pass = tok.DB.Password

	if tok.DB.Host != "" {
		host = tok.DB.Host
	}
	if tok.DB.Port > 0 {
		port = tok.DB.Port
	}
	if user == "" {
		user = "postgres"
	}

	// Se o token especificou uma porta, usa diretamente
	if tok.DB.Port > 0 {
		fmt.Printf("  Testando %s:%d...", host, port)
		if pg := DetectPostgres(); pg != nil && pg.Port == port {
			fmt.Printf(" %s encontrado\n", green("✓"))
		}
	} else {
		// Auto-detecção: varre portas
		fmt.Printf("  Varrendo portas PostgreSQL")
		pg := DetectPostgres()
		if pg != nil {
			host = pg.Host
			port = pg.Port
			fmt.Printf(" %s porta %d\n", green("✓"), port)
		} else {
			fmt.Printf(" %s\n", yellow("não detectado automaticamente"))
			host = promptString("  Host do banco", "localhost")
			port = promptInt("  Porta do banco", 5432)
		}
	}

	// Nome do banco
	if name == "" {
		name = promptString("  Nome do banco de dados", "sga")
	}

	// Usuário
	if user == "" {
		user = promptString("  Usuário do banco", "postgres")
	}

	// Senha — pede somente se não veio no token
	if pass == "" {
		fmt.Printf("  Senha do banco (usuário %s): ", bold(user))
		pass = readPassword()
	}

	// Testa a conexão
	fmt.Printf("  Testando conexão com o banco...")
	ver, err := TestPGConnection(host, port, name, user, pass)
	if err != nil {
		fmt.Printf(" %s\n\n", red("✗ falhou"))
		fmt.Printf("  %s %v\n\n", red("Erro:"), err)
		fmt.Printf("  Verifique as credenciais e tente novamente.\n")

		// Permite corrigir as credenciais
		fmt.Println()
		user  = promptString("  Corrigir usuário", user)
		fmt.Printf("  Nova senha: ")
		pass  = readPassword()
		name  = promptString("  Nome do banco", name)

		ver2, err2 := TestPGConnection(host, port, name, user, pass)
		if err2 != nil {
			fatal("Não foi possível conectar ao banco de dados: %v", err2)
		}
		ver = ver2
	}

	pgVersion := ver
	if len(pgVersion) > 25 {
		pgVersion = pgVersion[:25] + "..."
	}
	fmt.Printf(" %s %s\n", green("✓"), dim(pgVersion))
	return
}

// ── Pré-requisitos ────────────────────────────────────────────────────────────

func checkPrereqs() {
	// Windows
	if runtime.GOOS != "windows" {
		fmt.Printf("  %s Sistema: %s (instalação em Linux/Mac usa Systemd)\n", green("✓"), runtime.GOOS)
	} else {
		fmt.Printf("  %s Windows detectado\n", green("✓"))
	}

	// Administrador
	if isAdmin() {
		fmt.Printf("  %s Executando como Administrador\n", green("✓"))
	} else {
		fmt.Printf("  %s %s\n\n", red("✗"), red("Este instalador precisa ser executado como Administrador."))
		fmt.Printf("  Clique com botão direito no PowerShell → 'Executar como administrador'\n")
		os.Exit(1)
	}
}

// ── Escrita do config.json ────────────────────────────────────────────────────

func writeConfig(tok *SetupToken, agentID, cnpj, dbHost string, dbPort int, dbName, dbUser, dbPass string) string {
	cnpjClean := strings.NewReplacer(".", "", "/", "", "-", "").Replace(cnpj)

	mqttUser := tok.MQTTUser
	if mqttUser == "" {
		mqttUser = "agent"
	}
	broker := tok.Broker
	if broker == "" {
		broker = "mqtts://mobilev2.gruposgapetro.com.br:8883"
	}
	portalURL := tok.PortalURL
	if portalURL == "" {
		portalURL = "https://mobilev2.gruposgapetro.com.br:4444"
	}

	cfg := map[string]interface{}{
		"agent_id":     agentID,
		"cliente_cnpj": cnpj,
		"jwt_token":    tok.JWT,
		"mqtt": map[string]interface{}{
			"broker":                 broker,
			"client_id":              "agent-" + cnpjClean,
			"username":               mqttUser,
			"password":               tok.MQTTPass,
			"keep_alive_seconds":     30,
			"reconnect_wait_seconds": 5,
		},
		"database": map[string]interface{}{
			"host":                  dbHost,
			"port":                  dbPort,
			"name":                  dbName,
			"user":                  dbUser,
			"password":              dbPass,
			"ssl_mode":              "disable",
			"max_connections":       5,
			"query_timeout_seconds": 30,
		},
		"cache": map[string]interface{}{
			"path":                  filepath.Join(installDir, "agent.db"),
			"max_age_minutes":       15,
			"vacuum_interval_hours": 24,
		},
		"log": map[string]interface{}{
			"level":       "info",
			"path":        filepath.Join(installDir, "agent.log"),
			"max_size_mb": 50,
			"max_backups": 3,
		},
		"portal": map[string]interface{}{
			"url":         portalURL,
			"push_secret": tok.PushSecret,
		},
		"http": map[string]interface{}{
			"port": 8765,
		},
	}

	if err := os.MkdirAll(installDir, 0755); err != nil {
		fatal("Criando diretório de instalação: %v", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		fatal("Serializando configuração: %v", err)
	}

	cfgPath := filepath.Join(installDir, "config.json")
	if err := os.WriteFile(cfgPath, data, 0600); err != nil {
		fatal("Salvando configuração: %v", err)
	}

	return cfgPath
}

// ── Instalação do serviço ─────────────────────────────────────────────────────

func installService() {
	// Copia o executável para o diretório de instalação
	exePath, err := os.Executable()
	if err != nil {
		fatal("Obtendo caminho do executável: %v", err)
	}

	destExe := filepath.Join(installDir, exeName)

	// Se já existe o serviço, para e desinstala
	stopAndUninstall()

	// Copia o exe
	data, err := os.ReadFile(exePath)
	if err != nil {
		fatal("Lendo executável: %v", err)
	}
	if err := os.WriteFile(destExe, data, 0755); err != nil {
		fatal("Copiando executável: %v", err)
	}
	fmt.Printf("  %s Executável copiado para %s\n", green("✓"), dim(installDir))

	// Instala como serviço Windows
	cmd := exec.Command(destExe, "install")
	cmd.Dir = installDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		fatal("Instalando serviço: %v\n%s", err, string(out))
	}
	fmt.Printf("  %s Serviço %s instalado\n", green("✓"), bold(serviceName))

	// Configura início automático e restart em falha via sc.exe
	runSC("config", serviceName, "start=", "auto")
	runSC("failure", serviceName, "reset=", "60", "actions=", "restart/2000/restart/5000/restart/10000")

	// Inicia o serviço
	if err := exec.Command("net", "start", serviceName).Run(); err != nil {
		// Tenta com sc start também
		if err2 := exec.Command("sc", "start", serviceName).Run(); err2 != nil {
			fmt.Printf("  %s Serviço não iniciou (verifique os logs)\n", yellow("!"))
			return
		}
	}

	time.Sleep(2 * time.Second)
	fmt.Printf("  %s Serviço iniciado (Automatic)\n", green("✓"))
}

func stopAndUninstall() {
	out, err := exec.Command("sc", "query", serviceName).CombinedOutput()
	if err != nil || !strings.Contains(string(out), serviceName) {
		return // serviço não existe
	}
	fmt.Printf("  %s Removendo versão anterior...\n", yellow("↻"))
	_ = exec.Command("net", "stop", serviceName).Run()
	time.Sleep(2 * time.Second)
	destExe := filepath.Join(installDir, exeName)
	_ = exec.Command(destExe, "uninstall").Run()
	time.Sleep(1 * time.Second)
}

func runSC(args ...string) {
	_ = exec.Command("sc", args...).Run()
}

// ── Verificação final ─────────────────────────────────────────────────────────

func verifyRunning() {
	// Aguarda o serviço estabilizar
	fmt.Printf("  Aguardando o serviço inicializar")
	for i := 0; i < 8; i++ {
		time.Sleep(500 * time.Millisecond)
		fmt.Printf(".")
		out, _ := exec.Command("sc", "query", serviceName).CombinedOutput()
		if strings.Contains(string(out), "RUNNING") {
			fmt.Printf(" %s\n", green("✓"))
			fmt.Printf("  %s Serviço SGAPetroAgent: RUNNING\n", green("✓"))
			return
		}
	}
	fmt.Printf(" %s\n", yellow("aguardando"))
	fmt.Printf("  %s O serviço pode levar alguns segundos para subir completamente.\n", yellow("!"))
}

// ── Helpers de I/O ────────────────────────────────────────────────────────────

func promptString(label, defaultVal string) string {
	fmt.Printf("  %s [%s]: ", label, dim(defaultVal))
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		v := strings.TrimSpace(scanner.Text())
		if v != "" {
			return v
		}
	}
	return defaultVal
}

func promptInt(label string, defaultVal int) int {
	fmt.Printf("  %s [%s]: ", label, dim(fmt.Sprintf("%d", defaultVal)))
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		v := strings.TrimSpace(scanner.Text())
		if v != "" {
			var n int
			if _, err := fmt.Sscanf(v, "%d", &n); err == nil && n > 0 {
				return n
			}
		}
	}
	return defaultVal
}

func readPassword() string {
	// Em Windows: usa PowerShell Read-Host -AsSecureString se disponível
	// Fallback: lê normalmente (sem ocultar — limitação sem dependência de termbox)
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text())
	}
	return ""
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

func extractJWTInfo(tokenStr, fallbackNome string) (cnpj, nome string) {
	cnpj = "N/A"
	nome = fallbackNome
	if nome == "" {
		nome = "Cliente"
	}

	// Decodifica sem verificar assinatura — só para exibição
	p, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return
	}
	claims, ok := p.Claims.(jwt.MapClaims)
	if !ok {
		return
	}
	if v, ok := claims["cnpj"].(string); ok && v != "" {
		cnpj = v
	}
	return
}

func extractPlano(tokenStr string) string {
	p, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return "standard"
	}
	claims, ok := p.Claims.(jwt.MapClaims)
	if !ok {
		return "standard"
	}
	if v, ok := claims["plano"].(string); ok && v != "" {
		return v
	}
	return "standard"
}

// ── Saída formatada ───────────────────────────────────────────────────────────

func printBanner() {
	fmt.Println()
	fmt.Println(cyan("╔══════════════════════════════════════════════════╗"))
	fmt.Println(cyan("║") + bold("   SGA Petro — Instalação do Agente Local         ") + cyan("║"))
	fmt.Println(cyan("╚══════════════════════════════════════════════════╝"))
	fmt.Println()
}

func stepHeader(n, total int, label string) {
	fmt.Printf("\n%s [%d/%d] %s\n",
		cyan("▶"),
		n, total,
		bold(label),
	)
}

func printStep(_, _ int, label string) {
	fmt.Printf("\n%s %s\n", cyan("▶"), bold(label))
}

func printSuccess(nome, cnpj string) {
	fmt.Println()
	fmt.Println(green("╔══════════════════════════════════════════════════╗"))
	fmt.Println(green("║") + bold("   ✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!            ") + green("║"))
	fmt.Println(green("║") + fmt.Sprintf("                                                  ") + green("║"))
	fmt.Println(green("║") + fmt.Sprintf("   Cliente : %-37s", nome) + green("║"))
	fmt.Println(green("║") + fmt.Sprintf("   CNPJ    : %-37s", cnpj) + green("║"))
	fmt.Println(green("║") + fmt.Sprintf("   Serviço : %-37s", serviceName+" (Automatic)") + green("║"))
	fmt.Println(green("║") + fmt.Sprintf("   Log     : %-37s", installDir+`\agent.log`) + green("║"))
	fmt.Println(green("╚══════════════════════════════════════════════════╝"))
	fmt.Println()
}

func fatal(format string, args ...interface{}) {
	fmt.Printf("\n  %s %s\n\n", red("✗ ERRO:"), fmt.Sprintf(format, args...))
	os.Exit(1)
}

// ── Windows ANSI e Admin ──────────────────────────────────────────────────────

func isAdmin() bool {
	if runtime.GOOS != "windows" {
		return os.Getuid() == 0
	}
	// No Windows: tenta abrir uma chave restrita do registro
	_, err := os.Open(`\\.\PHYSICALDRIVE0`)
	return err == nil
}
