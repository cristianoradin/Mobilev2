#!/bin/bash
# Build do agente para Linux (systemd)
set -e

VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
OUTPUT="dist/sga-agent-linux-${VERSION}"

mkdir -p dist

echo "Building Linux binary: ${OUTPUT}"

GOOS=linux \
GOARCH=amd64 \
CGO_ENABLED=0 \
go build \
  -ldflags="-s -w -X main.version=${VERSION}" \
  -trimpath \
  -o "${OUTPUT}" \
  ./cmd/agent

chmod +x "${OUTPUT}"
ls -lh "${OUTPUT}"
echo "✓ Linux build concluído: ${OUTPUT}"
echo ""
echo "Instalação no Linux:"
echo "  cp ${OUTPUT} /usr/local/bin/sga-agent"
echo "  cp config.example.json /etc/sga-agent/config.json"
echo "  # edite /etc/sga-agent/config.json"
echo "  sga-agent /etc/sga-agent/config.json install"
echo "  systemctl enable SGAPetroAgent"
echo "  systemctl start SGAPetroAgent"
