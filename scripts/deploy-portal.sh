#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-portal.sh — Sync + build apenas do portal Next.js (sem PWA)
# Executado da máquina LOCAL (Mac)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVER="master@cloud.gruposgapetro.com.br"
SSH_PORT=22110
SGA_DIR="/opt/sga"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SSH="ssh -p $SSH_PORT -o StrictHostKeyChecking=no"

echo "════════════════════════════════════════════════════════"
echo "  SGA Petro — Deploy Portal (fast)"
echo "  Destino: $SERVER"
echo "════════════════════════════════════════════════════════"

# ── 1. Sync do infra ─────────────────────────────────────────────────────────
echo "[1/3] Enviando infra..."
$SSH "$SERVER" "mkdir -p $SGA_DIR/infra"
rsync -avz \
  -e "ssh -p $SSH_PORT -o StrictHostKeyChecking=no" \
  --exclude='.env' \
  --exclude='nginx/certs' \
  "$PROJECT_ROOT/infra/" \
  "$SERVER:$SGA_DIR/infra/"
echo "  Infra sincronizada ✓"

# ── 2. Sync do portal (código-fonte) ─────────────────────────────────────────
echo "[2/3] Enviando código do portal..."
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

# ── 3. Build + restart no servidor ───────────────────────────────────────────
echo "[3/3] Build e restart do container portal..."
$SSH "$SERVER" bash <<REMOTE
  set -e
  cd $SGA_DIR/infra

  if [ ! -f .env ]; then
    echo "ERRO: $SGA_DIR/infra/.env não encontrado!"
    exit 1
  fi

  echo "  Building portal..."
  docker compose build portal

  echo "  Restarting portal..."
  docker compose up -d --no-deps portal

  echo "  Aguardando portal ficar saudável..."
  for i in \$(seq 1 30); do
    STATUS=\$(curl -sf http://127.0.0.1:3001/api/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "")
    if [ "\$STATUS" = "ok" ] || [ "\$STATUS" = "degraded" ]; then
      echo "  Portal OK (status=\$STATUS) ✓"
      break
    fi
    sleep 3
    echo "  tentativa \$i/30..."
  done
REMOTE
echo "  Container reiniciado ✓"

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Portal deployado!"
echo "  https://cloud.gruposgapetro.com.br:3001"
echo "════════════════════════════════════════════════════════"
