# ============================================================
#  SGA Petro — Instalador do Agente Local (Windows)
#  Execute como Administrador:
#    PowerShell -ExecutionPolicy Bypass -File install-windows.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$InstallDir = "C:\SGA-Petro"
$ServiceName = "SGAPetroAgent"
$ExeName = "sga-agent.exe"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  SGA Petro — Instalacao do Agente" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# ── Verifica se está rodando como Administrador ──────────────────────────────
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal   = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERRO: Execute este script como Administrador." -ForegroundColor Red
    Write-Host "  Clique com botao direito no PowerShell > 'Executar como administrador'" -ForegroundColor Yellow
    exit 1
}

# ── Verifica se config.json existe na pasta atual ────────────────────────────
$configSrc = Join-Path $PSScriptRoot "config.json"
if (-not (Test-Path $configSrc)) {
    Write-Host "ERRO: config.json nao encontrado em $PSScriptRoot" -ForegroundColor Red
    Write-Host "  Copie e preencha o config.json antes de instalar." -ForegroundColor Yellow
    exit 1
}

# ── Cria diretório de instalação ─────────────────────────────────────────────
Write-Host "1. Criando diretorio $InstallDir..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# ── Para e remove serviço anterior (se existir) ───────────────────────────────
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "2. Removendo versao anterior do servico..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    & "$InstallDir\$ExeName" uninstall 2>$null
    Start-Sleep -Seconds 1
}

# ── Copia arquivos ────────────────────────────────────────────────────────────
Write-Host "3. Copiando arquivos..." -ForegroundColor Green
Copy-Item -Path (Join-Path $PSScriptRoot $ExeName)    -Destination $InstallDir -Force
Copy-Item -Path $configSrc                             -Destination $InstallDir -Force

# ── Instala e inicia o serviço ────────────────────────────────────────────────
Write-Host "4. Instalando servico Windows..." -ForegroundColor Green
Set-Location $InstallDir
& ".\$ExeName" install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao instalar servico." -ForegroundColor Red
    exit 1
}

# Configura inicio automatico
Set-Service -Name $ServiceName -StartupType Automatic

Write-Host "5. Iniciando servico..." -ForegroundColor Green
Start-Service -Name $ServiceName
Start-Sleep -Seconds 3

# ── Verifica status ────────────────────────────────────────────────────────────
$svc = Get-Service -Name $ServiceName
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
if ($svc.Status -eq "Running") {
    Write-Host "  INSTALACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
    Write-Host "  Servico: $($svc.DisplayName)" -ForegroundColor Green
    Write-Host "  Status:  $($svc.Status)" -ForegroundColor Green
    Write-Host "  Diretorio: $InstallDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Logs: $InstallDir\agent.log" -ForegroundColor Gray
    Write-Host "  Para verificar: Get-Service $ServiceName" -ForegroundColor Gray
} else {
    Write-Host "  ATENCAO: Servico instalado mas nao iniciou." -ForegroundColor Yellow
    Write-Host "  Verifique o log: $InstallDir\agent.log" -ForegroundColor Yellow
    Write-Host "  Status: $($svc.Status)" -ForegroundColor Yellow
}
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
