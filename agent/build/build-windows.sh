#!/bin/bash
# Build do agente para Windows (gera .exe sem runtime)
set -e

VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
OUTPUT="dist/sga-agent-windows-${VERSION}.exe"

mkdir -p dist

echo "Building Windows binary: ${OUTPUT}"

GOOS=windows \
GOARCH=amd64 \
CGO_ENABLED=0 \
go build \
  -ldflags="-s -w -X main.version=${VERSION}" \
  -trimpath \
  -o "${OUTPUT}" \
  ./cmd/agent

ls -lh "${OUTPUT}"
echo "✓ Windows build concluído: ${OUTPUT}"
echo ""
echo "Instalação no Windows (como Administrador):"
echo "  ${OUTPUT} install"
echo "  ${OUTPUT} start"
