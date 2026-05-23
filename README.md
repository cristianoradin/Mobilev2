# Mobilev2 — SGA Petro

Plataforma analítica Cloud+Edge para postos de combustível.

## Estrutura do projeto

```
Mobilev2/
├── pwa/          # App mobile (React + Vite + Tailwind v4)
├── portal/       # Painel admin (Next.js 15 + PostgreSQL)
├── agent/        # Agente Go (Edge — roda no posto)
├── infra/        # Docker Compose + nginx + EMQX
└── scripts/      # Scripts de setup e deploy
```

## Stack

| Camada      | Tecnologia                                    |
|-------------|-----------------------------------------------|
| Mobile PWA  | React 19, Vite, Tailwind v4, MQTT.js          |
| Portal Admin| Next.js 15, PostgreSQL 16, JWT RS256          |
| Agente Edge | Go 1.23, SQLite, MQTT, HTTP server            |
| Broker MQTT | EMQX 5.8 (Docker)                             |
| Reverse proxy| nginx (SSL termination, portas 4443/9083)     |

## URLs de produção

| Serviço      | URL                                                  |
|--------------|------------------------------------------------------|
| PWA Mobile   | https://mobilev2.gruposgapetro.com.br:4443           |
| Portal Admin | https://mobilev2.gruposgapetro.com.br:4444           |
| MQTT WSS     | wss://mobilev2.gruposgapetro.com.br:9083/mqtt        |

## Configuração local

Copie os arquivos de exemplo e preencha com os valores corretos:

```bash
cp portal/.env.example portal/.env.local
cp pwa/.env.example pwa/.env.local
cp agent/.env.example agent/.env
cp agent/config.example.json agent/config.json
```

## Desenvolvimento

```bash
# Portal admin
cd portal && npm install && npm run dev   # → localhost:3000

# PWA mobile
cd pwa && npm install && npm run dev      # → localhost:5173

# Agente Go
cd agent && go run ./cmd/agent/main.go
```

## Deploy

```bash
# Build e deploy do PWA para o servidor
cd pwa && npm run build
rsync -avz dist/ master@cloud.gruposgapetro.com.br:/var/www/sga-pwa/

# Portal roda via Docker no servidor (infra/docker-compose.yml)
```
