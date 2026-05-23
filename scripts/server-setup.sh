#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# server-setup.sh — Configura o servidor pela primeira vez
# Executado como master@cloud.gruposgapetro.com.br
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="cloud.gruposgapetro.com.br"
SGA_DIR="/opt/sga"
PWA_DIR="/var/www/sga-pwa"
EMAIL="cristianoradin@gmail.com"

echo "════════════════════════════════════════════════════════"
echo "  SGA Petro — Setup do Servidor"
echo "  Domínio: $DOMAIN"
echo "════════════════════════════════════════════════════════"

# ── 1. Diretórios ────────────────────────────────────────────────────────────
echo "[1/7] Criando diretórios..."
sudo mkdir -p "$SGA_DIR" "$PWA_DIR"
sudo chown -R master:master "$SGA_DIR" "$PWA_DIR"

# ── 2. Certbot (Let's Encrypt) ───────────────────────────────────────────────
echo "[2/7] Instalando certbot..."
if ! command -v certbot &>/dev/null; then
  sudo dnf install -y certbot python3-certbot-nginx 2>/dev/null || \
  sudo yum install -y certbot python3-certbot-nginx 2>/dev/null || \
  sudo apt-get install -y certbot python3-certbot-nginx 2>/dev/null
fi

echo "[2/7] Obtendo certificado SSL para $DOMAIN..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  sudo certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL" \
    --redirect || echo "AVISO: certbot falhou, continuando sem SSL"
else
  echo "  Certificado já existe, pulando."
fi

# ── 3. Nginx — vhost SGA PWA + API ──────────────────────────────────────────
echo "[3/7] Configurando nginx para SGA..."
sudo tee /etc/nginx/conf.d/sga.conf > /dev/null <<'NGINX_CONF'
# SGA Petro — PWA + Portal API
server {
    listen 80;
    server_name cloud.gruposgapetro.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cloud.gruposgapetro.com.br;

    ssl_certificate     /etc/letsencrypt/live/cloud.gruposgapetro.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.gruposgapetro.com.br/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # ── Portal API (Next.js) ─────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }

    # ── MQTT WebSocket (EMQX) ─────────────────────────────────────────────
    location /mqtt {
        proxy_pass         http://127.0.0.1:8083;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # ── Avaliação (serviço existente — preservado) ────────────────────────
    location /avaliacao {
        proxy_pass         http://127.0.0.1:4545;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
    location /api/avaliacao {
        proxy_pass         http://127.0.0.1:4545;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }

    # ── PWA (React/Vite — SPA com HTML5 history) ─────────────────────────
    root /var/www/sga-pwa;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Cache agressivo para assets com hash no nome
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}

# ── Portal Admin (Next.js UI — acessível via HTTPS na 3001) ──────────────────
server {
    listen 3001 ssl http2;
    server_name cloud.gruposgapetro.com.br;

    ssl_certificate     /etc/letsencrypt/live/cloud.gruposgapetro.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.gruposgapetro.com.br/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
}
NGINX_CONF

# Valida config nginx
sudo nginx -t && sudo systemctl reload nginx
echo "  nginx recarregado ✓"

# ── 4. Gerar chaves RSA (JWT / VAPID) ────────────────────────────────────────
echo "[4/7] Gerando chaves RSA e VAPID..."

KEY_DIR="$SGA_DIR/keys"
mkdir -p "$KEY_DIR"

# RSA 2048 para JWT
if [ ! -f "$KEY_DIR/jwt_private.pem" ]; then
  openssl genrsa -out "$KEY_DIR/jwt_private.pem" 2048
  openssl rsa -in "$KEY_DIR/jwt_private.pem" -pubout -out "$KEY_DIR/jwt_public.pem"
  echo "  Chaves JWT geradas ✓"
else
  echo "  Chaves JWT já existem, pulando."
fi

# VAPID via Node (web-push)
if [ ! -f "$KEY_DIR/vapid.json" ]; then
  node -e "
const webpush = require('/opt/sga/portal/node_modules/web-push');
const keys = webpush.generateVAPIDKeys();
const fs = require('fs');
fs.writeFileSync('/opt/sga/keys/vapid.json', JSON.stringify(keys, null, 2));
console.log('pub:', keys.publicKey);
console.log('priv:', keys.privateKey);
" 2>/dev/null || {
    # fallback: usar as chaves do .env se existirem
    echo "  AVISO: não foi possível gerar chaves VAPID via Node, usando as do .env"
  }
fi

# ── 5. Criar .env de produção ─────────────────────────────────────────────────
echo "[5/7] Criando .env de produção..."

JWT_PRIVATE=$(cat "$KEY_DIR/jwt_private.pem" | awk '{printf "%s\\n", $0}')
JWT_PUBLIC=$(cat "$KEY_DIR/jwt_public.pem" | awk '{printf "%s\\n", $0}')

if [ -f "$KEY_DIR/vapid.json" ]; then
  VAPID_PUB=$(python3 -c "import json; d=json.load(open('$KEY_DIR/vapid.json')); print(d['publicKey'])")
  VAPID_PRIV=$(python3 -c "import json; d=json.load(open('$KEY_DIR/vapid.json')); print(d['privateKey'])")
else
  VAPID_PUB="${VAPID_PUB:-}"
  VAPID_PRIV="${VAPID_PRIV:-}"
fi

POSTGRES_PASS=$(openssl rand -hex 16)
EMQX_COOKIE=$(openssl rand -hex 20)
EMQX_PASS=$(openssl rand -hex 12)
JWT_SECRET=$(openssl rand -hex 32)
PUSH_SECRET=$(openssl rand -hex 24)

cat > "$SGA_DIR/infra/.env" <<EOF
# Gerado automaticamente em $(date -u +%Y-%m-%dT%H:%M:%SZ)

POSTGRES_DB=sgapetro
POSTGRES_USER=sgapetro
POSTGRES_PASSWORD=$POSTGRES_PASS

EMQX_COOKIE=$EMQX_COOKIE
EMQX_ADMIN_USER=admin
EMQX_ADMIN_PASS=$EMQX_PASS

JWT_SECRET=$JWT_SECRET
JWT_PRIVATE_KEY=$JWT_PRIVATE
JWT_PUBLIC_KEY=$JWT_PUBLIC

VAPID_PUBLIC_KEY=$VAPID_PUB
VAPID_PRIVATE_KEY=$VAPID_PRIV
VAPID_CONTACT=mailto:cristianoradin@gmail.com

PUSH_SECRET=$PUSH_SECRET

ADMIN_EMAIL=admin@gruposgapetro.com.br
ADMIN_PASSWORD=$(openssl rand -base64 14)
ADMIN_NOME=Admin SGA Petro
EOF

chmod 600 "$SGA_DIR/infra/.env"
echo "  .env criado em $SGA_DIR/infra/.env ✓"

# ── 6. Firewall ───────────────────────────────────────────────────────────────
echo "[6/7] Abrindo portas no firewall..."
sudo firewall-cmd --permanent --add-port=443/tcp  2>/dev/null || true
sudo firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
sudo firewall-cmd --permanent --add-port=1883/tcp 2>/dev/null || true
sudo firewall-cmd --permanent --add-port=8083/tcp 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true

# Para sistemas sem firewalld (iptables):
sudo iptables -I INPUT -p tcp --dport 443  -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 1883 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 8083 -j ACCEPT 2>/dev/null || true

echo "  Portas abertas ✓"

# ── 7. Resumo ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Setup concluído!"
echo "  Próximos passos:"
echo "    1. cd $SGA_DIR/infra && docker compose up -d"
echo "    2. Copiar dist/ da PWA para $PWA_DIR"
echo "    3. Ver .env: cat $SGA_DIR/infra/.env"
echo ""
echo "  Acesse o portal admin em:"
echo "    https://$DOMAIN:3001"
echo ""
echo "  Credenciais admin:"
grep ADMIN_ $SGA_DIR/infra/.env | grep -v '#'
echo "════════════════════════════════════════════════════════"
