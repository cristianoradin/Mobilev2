#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Build local + sync para o servidor + start dos containers
# Executado da máquina LOCAL (Mac)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVER="master@cloud.gruposgapetro.com.br"
SSH_PORT=22110
SGA_DIR="/opt/sga"
PWA_DIR="/var/www/sga-pwa"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SSH="ssh -p $SSH_PORT -o StrictHostKeyChecking=no"
SCP="scp -P $SSH_PORT -o StrictHostKeyChecking=no"

echo "════════════════════════════════════════════════════════"
echo "  SGA Petro — Deploy"
echo "  Destino: $SERVER"
echo "════════════════════════════════════════════════════════"

# ── 1. Build PWA ─────────────────────────────────────────────────────────────
echo "[1/5] Build da PWA..."
cd "$PROJECT_ROOT/pwa"

# Usa o .env.production existente — NÃO sobrescreve
if [ ! -f .env.production ]; then
  echo "AVISO: pwa/.env.production não encontrado. Crie o arquivo antes de deployar."
  exit 1
fi
echo "  Usando pwa/.env.production existente"

npm run build
echo "  PWA buildada em dist/ ✓"

# ── 2. Sync da PWA para o servidor ───────────────────────────────────────────
echo "[2/5] Enviando PWA para o servidor..."
$SSH "$SERVER" "mkdir -p $PWA_DIR"
rsync -avz --delete \
  -e "ssh -p $SSH_PORT -o StrictHostKeyChecking=no" \
  "$PROJECT_ROOT/pwa/dist/" \
  "$SERVER:$PWA_DIR/"
echo "  PWA sincronizada ✓"

# ── 3. Sync do infra (docker-compose, configs) ───────────────────────────────
echo "[3/5] Enviando infra..."
$SSH "$SERVER" "mkdir -p $SGA_DIR/infra"
rsync -avz \
  -e "ssh -p $SSH_PORT -o StrictHostKeyChecking=no" \
  --exclude='.env' \
  --exclude='nginx/certs' \
  "$PROJECT_ROOT/infra/" \
  "$SERVER:$SGA_DIR/infra/"
echo "  Infra sincronizada ✓"

# ── 3b. Sync do portal (código-fonte Next.js) ────────────────────────────────
echo "[3b/5] Enviando código do portal..."
$SSH "$SERVER" "mkdir -p $SGA_DIR/portal"
rsync -avz --delete \
  -e "ssh -p $SSH_PORT -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  --exclude='.env' \
  "$PROJECT_ROOT/portal/" \
  "$SERVER:$SGA_DIR/portal/"
echo "  Portal sincronizado ✓"

# ── 4. Build e start do portal (Docker) ──────────────────────────────────────
echo "[4/5] Build e start do portal via Docker..."
$SSH "$SERVER" bash <<REMOTE
  set -e
  cd $SGA_DIR/infra

  # Verifica se .env existe
  if [ ! -f .env ]; then
    echo "ERRO: $SGA_DIR/infra/.env não encontrado!"
    echo "Execute server-setup.sh primeiro."
    exit 1
  fi

  # Build e start
  docker compose pull --ignore-pull-failures 2>/dev/null || true
  docker compose build portal
  docker compose up -d

  echo "Aguardando portal ficar saudável..."
  for i in \$(seq 1 30); do
    STATUS=\$(curl -sf http://127.0.0.1:3001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "")
    if [ "\$STATUS" = "ok" ] || [ "\$STATUS" = "degraded" ]; then
      echo "Portal OK (status=\$STATUS) ✓"
      break
    fi
    sleep 3
    echo "  tentativa \$i/30..."
  done
REMOTE
echo "  Containers iniciados ✓"

# ── 5. Reload nginx ───────────────────────────────────────────────────────────
echo "[5/5] Recarregando nginx..."
$SSH "$SERVER" "sudo nginx -t && sudo systemctl reload nginx"
echo "  nginx OK ✓"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Deploy concluído!"
echo ""
echo "  PWA:    https://mobilev2.gruposgapetro.com.br:4443"
echo "  Portal: https://mobilev2.gruposgapetro.com.br:4444"
echo "  Health: https://mobilev2.gruposgapetro.com.br:4444/api/health"
echo "  EMQX:   http://localhost:18083 (via SSH tunnel)"
echo "════════════════════════════════════════════════════════"
