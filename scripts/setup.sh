#!/usr/bin/env bash
# SGA Petro — Setup inicial do servidor cloud
# Uso: ./scripts/setup.sh
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/../infra" && pwd)"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "══════════════════════════════════════════"
echo "  SGA Petro — Setup Cloud"
echo "══════════════════════════════════════════"

# ── 1. Verificações ──────────────────────────────────────────────────────────
command -v docker        >/dev/null || { echo "❌ Docker não encontrado"; exit 1; }
command -v docker compose >/dev/null || { echo "❌ Docker Compose não encontrado"; exit 1; }
command -v openssl       >/dev/null || { echo "❌ OpenSSL não encontrado"; exit 1; }

# ── 2. Gerar chaves RSA (se não existirem) ──────────────────────────────────
KEY_DIR="$INFRA_DIR/keys"
mkdir -p "$KEY_DIR"

if [[ ! -f "$KEY_DIR/private.pem" ]]; then
  echo "🔑 Gerando par de chaves RSA 2048-bit..."
  openssl genrsa -out "$KEY_DIR/private.pem" 2048 2>/dev/null
  openssl rsa -in "$KEY_DIR/private.pem" -pubout -out "$KEY_DIR/public.pem" 2>/dev/null
  chmod 600 "$KEY_DIR/private.pem"
  echo "   ✓ Chaves salvas em $KEY_DIR/"
else
  echo "   ✓ Chaves RSA já existem"
fi

# ── 3. Criar .env da infra (se não existir) ──────────────────────────────────
ENV_FILE="$INFRA_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;} END{printf "\n"}' "$KEY_DIR/private.pem")
  PUBLIC_KEY=$(awk  'NF {sub(/\r/, ""); printf "%s\\n",$0;} END{printf "\n"}' "$KEY_DIR/public.pem")
  PG_PASS=$(openssl rand -hex 16)
  EMQX_COOKIE=$(openssl rand -hex 20)

  cat > "$ENV_FILE" <<EOF
POSTGRES_DB=sgapetro
POSTGRES_USER=sgapetro
POSTGRES_PASSWORD=${PG_PASS}
EMQX_COOKIE=${EMQX_COOKIE}
EMQX_ADMIN_USER=admin
EMQX_ADMIN_PASS=$(openssl rand -hex 12)
EMQX_API_KEY=sga-api-key
EMQX_API_SECRET=$(openssl rand -hex 24)
JWT_PRIVATE_KEY="${PRIVATE_KEY}"
JWT_PUBLIC_KEY="${PUBLIC_KEY}"
EOF
  echo "   ✓ $ENV_FILE criado"
fi

# ── 4. Criar .env do portal ───────────────────────────────────────────────────
PORTAL_ENV="$ROOT_DIR/portal/.env.local"
if [[ ! -f "$PORTAL_ENV" ]]; then
  source "$ENV_FILE"
  cat > "$PORTAL_ENV" <<EOF
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}
JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
EMQX_API_URL=http://localhost:18083/api/v5
EMQX_API_KEY=${EMQX_API_KEY}
EMQX_API_SECRET=${EMQX_API_SECRET}
EOF
  echo "   ✓ portal/.env.local criado"
fi

# ── 5. Subir serviços ─────────────────────────────────────────────────────────
echo ""
echo "🐳 Subindo Docker Compose..."
cd "$INFRA_DIR"
docker compose --env-file .env up -d --build

echo ""
echo "⏳ Aguardando PostgreSQL ficar pronto..."
until docker compose exec -T postgres pg_isready -U sgapetro -q 2>/dev/null; do
  sleep 2
done
echo "   ✓ PostgreSQL pronto"

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Setup concluído!"
echo ""
echo "  Portal:    http://localhost:3000"
echo "  EMQX:      http://localhost:18083"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "  Chave pública RSA em: $KEY_DIR/public.pem"
echo "  (Embute esta chave no binário do agente Go)"
echo "══════════════════════════════════════════"
