'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TopBar }    from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button }    from '@/components/ui/Button'
import { Badge }     from '@/components/ui/Badge'
import { useToast, Toaster } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  Upload, RefreshCw, Send, Package, CheckCircle,
  Cpu, FileCode, AlertTriangle, WifiOff, Wifi, Clock,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Release {
  filename: string
  version:  string
  os:       string
  arch:     string
  sha256:   string
  size:     number
  url:      string
}

interface ClienteStatus {
  clienteId:       string
  clienteNome:     string
  cnpj:            string
  ativo:           boolean
  versao:          string | null
  status:          'online' | 'offline' | 'degraded' | null
  ultimoHeartbeat: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function AgentesPage() {
  const { toasts, toast, dismiss } = useToast()

  const [releases,     setReleases]     = useState<Release[]>([])
  const [clientes,     setClientes]     = useState<ClienteStatus[]>([])
  const [carregando,   setCarregando]   = useState(true)

  // Upload
  const [uploading,  setUploading]  = useState(false)
  const [version,    setVersion]    = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const fileRef                     = useRef<HTMLInputElement>(null)

  // Dispatch
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [targetCnpj,      setTargetCnpj]      = useState<string>('todos')
  const [sending,         setSending]          = useState(false)
  const [confirmOpen,     setConfirmOpen]      = useState(false)

  const latestVersion = releases[0]?.version ?? null

  const loadData = useCallback(() => {
    setCarregando(true)
    Promise.all([
      fetch('/api/agent/release').then(r => r.json()),
      fetch('/api/agent/status').then(r => r.json()),
    ])
      .then(([rel, sta]: [{ releases: Release[] }, { clientes: ClienteStatus[] }]) => {
        const rels = rel.releases ?? []
        setReleases(rels)
        setClientes(sta.clientes ?? [])
        if (rels[0]) setSelectedRelease(rels[0])
      })
      .catch(() => toast('Erro ao carregar dados', 'error'))
      .finally(() => setCarregando(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh do status a cada 30s
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/agent/status')
        .then(r => r.json())
        .then((d: { clientes: ClienteStatus[] }) => setClientes(d.clientes ?? []))
        .catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  async function handleUpload() {
    if (!file || !version.trim()) {
      toast('Selecione o arquivo e informe a versão', 'warning'); return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file',    file)
      form.append('version', version.trim())
      form.append('os',      'windows')
      form.append('arch',    'amd64')

      const res  = await fetch('/api/agent/release', { method: 'POST', body: form })
      const data = await res.json() as { ok?: boolean; filename?: string; sha256?: string; url?: string; error?: string }

      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro no upload', 'error'); return }

      toast(`Binário ${data.filename} enviado com sucesso`, 'success')
      setFile(null); setVersion('')
      if (fileRef.current) fileRef.current.value = ''
      loadData()
    } catch {
      toast('Erro ao enviar arquivo', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDispatch() {
    if (!selectedRelease) { toast('Selecione uma versão para enviar', 'warning'); return }
    setConfirmOpen(true)
  }

  async function doDispatch() {
    setConfirmOpen(false)
    if (!selectedRelease) return
    setSending(true)
    try {
      const body: Record<string, string> = {
        version: selectedRelease.version,
        url:     `https://mobilev2.gruposgapetro.com.br:4444${selectedRelease.url}`,
        sha256:  selectedRelease.sha256,
      }
      if (targetCnpj !== 'todos') body.cnpj = targetCnpj

      const res  = await fetch('/api/agent/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; sent?: number; failed?: number; total?: number; error?: string }

      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro ao enviar comando', 'error'); return }

      const msg = data.total !== undefined
        ? `Comando enviado: ${data.sent}/${data.total} agentes alcançados`
        : 'Comando enviado com sucesso'
      toast(msg, data.sent! > 0 ? 'success' : 'warning')
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSending(false)
    }
  }

  // ── Estatísticas rápidas ─────────────────────────────────────────────────────
  const total      = clientes.length
  const online     = clientes.filter(c => c.status === 'online').length
  const atualizados = clientes.filter(c => c.versao && latestVersion && compareVersions(c.versao, latestVersion) === 0).length
  const desatualizados = clientes.filter(c => c.versao && latestVersion && compareVersions(c.versao, latestVersion) < 0).length
  const semAgente  = clientes.filter(c => !c.versao).length

  return (
    <div>
      <TopBar title="Agentes" subtitle="Gerenciar e atualizar o agente local nos postos" />

      <div className="p-8 space-y-6">

        {/* ── Linha superior: Upload + Dispatch ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Upload */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
                  <Upload size={15} className="text-[#009c3b]" />
                </div>
                <p className="text-white font-semibold text-sm">Upload de Nova Versão</p>
                {releases[0] && (
                  <Badge variant="success" className="ml-auto">Atual: v{releases[0].version}</Badge>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Versão</label>
                <input
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="ex: 1.2.0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
                />
              </div>

              <div className="mb-5">
                <label className="block text-white/50 text-xs mb-1.5">Executável (.exe)</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    file ? 'border-[#009c3b]/40 bg-[#009c3b]/5' : 'border-white/10 hover:border-white/25'
                  }`}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".exe" className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <>
                      <CheckCircle size={20} className="text-[#009c3b] mx-auto mb-2" />
                      <p className="text-white text-sm font-medium">{file.name}</p>
                      <p className="text-white/40 text-xs">{formatBytes(file.size)}</p>
                    </>
                  ) : (
                    <>
                      <FileCode size={20} className="text-white/25 mx-auto mb-2" />
                      <p className="text-white/50 text-sm">Clique para selecionar o .exe</p>
                    </>
                  )}
                </div>
              </div>

              <Button className="w-full justify-center" loading={uploading}
                disabled={!file || !version.trim()} onClick={handleUpload}>
                <Upload size={14} />Enviar Binário
              </Button>
            </CardBody>
          </Card>

          {/* Dispatch */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/25 rounded-lg flex items-center justify-center">
                  <Send size={15} className="text-blue-400" />
                </div>
                <p className="text-white font-semibold text-sm">Disparar Atualização</p>
              </div>

              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Versão a instalar</label>
                {releases.length === 0 ? (
                  <p className="text-white/30 text-xs py-2">Nenhuma versão — faça upload primeiro</p>
                ) : (
                  <select value={selectedRelease?.filename ?? ''}
                    onChange={e => setSelectedRelease(releases.find(r => r.filename === e.target.value) ?? null)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all">
                    {releases.map(r => (
                      <option key={r.filename} value={r.filename}>
                        v{r.version} — {r.os}/{r.arch} ({formatBytes(r.size)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedRelease && (
                <div className="bg-black/30 rounded-lg p-3 mb-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">SHA256</p>
                  <code className="text-green-400/70 text-[10px] font-mono break-all">
                    {selectedRelease.sha256.slice(0, 32)}…
                  </code>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-white/50 text-xs mb-1.5">Enviar para</label>
                <select value={targetCnpj} onChange={e => setTargetCnpj(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all">
                  <option value="todos">🌐 Todos os clientes ativos ({clientes.length})</option>
                  {clientes.map(c => (
                    <option key={c.clienteId} value={c.cnpj.replace(/\D/g, '')}>
                      {c.clienteNome}
                      {c.versao ? ` — v${c.versao}` : ' — sem agente'}
                    </option>
                  ))}
                </select>
              </div>

              <Button className="w-full justify-center" loading={sending}
                disabled={!selectedRelease || clientes.length === 0} onClick={handleDispatch}>
                <RefreshCw size={14} />
                {targetCnpj === 'todos' ? 'Atualizar Todos' : 'Atualizar Cliente'}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ── Painel de status dos clientes ──────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
              Status dos Agentes
            </p>
            <button onClick={loadData}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors">
              <RefreshCw size={11} />Atualizar
            </button>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total',          value: total,          color: 'text-white/60',   bg: 'bg-white/5' },
              { label: 'Online',         value: online,         color: 'text-[#009c3b]',  bg: 'bg-[#009c3b]/10' },
              { label: 'Atualizados',    value: atualizados,    color: 'text-blue-400',   bg: 'bg-blue-500/10' },
              { label: 'Desatualizados', value: desatualizados + semAgente, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-white/8 rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabela de clientes */}
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
          ) : clientes.length === 0 ? (
            <Card><CardBody>
              <div className="py-8 text-center">
                <Package size={28} className="text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Nenhum cliente ativo</p>
              </div>
            </CardBody></Card>
          ) : (
            <Card>
              <div className="divide-y divide-white/6">
                {clientes.map(c => {
                  const isOnline    = c.status === 'online'
                  const hasAgent    = !!c.versao
                  const isUpToDate  = hasAgent && latestVersion
                    ? compareVersions(c.versao!, latestVersion) === 0
                    : false
                  const isOutdated  = hasAgent && latestVersion
                    ? compareVersions(c.versao!, latestVersion) < 0
                    : false

                  return (
                    <div key={c.clienteId} className="flex items-center gap-4 px-5 py-4">
                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        !hasAgent  ? 'bg-white/20' :
                        isOnline   ? 'bg-[#009c3b] shadow-sm shadow-[#009c3b]/50' :
                                     'bg-red-400'
                      }`} />

                      {/* Nome + CNPJ */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{c.clienteNome}</p>
                        <p className="text-white/30 text-xs font-mono">{c.cnpj}</p>
                      </div>

                      {/* Versão */}
                      <div className="text-right">
                        {!hasAgent ? (
                          <Badge variant="default">Sem agente</Badge>
                        ) : isUpToDate ? (
                          <Badge variant="success">v{c.versao}</Badge>
                        ) : isOutdated ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-yellow-400" />
                            <Badge variant="warning">v{c.versao}</Badge>
                          </div>
                        ) : (
                          <Badge variant="default">v{c.versao}</Badge>
                        )}
                      </div>

                      {/* Status online/offline */}
                      <div className="w-20 text-right">
                        {!hasAgent ? (
                          <span className="text-white/20 text-xs">—</span>
                        ) : isOnline ? (
                          <div className="flex items-center justify-end gap-1 text-[#009c3b]">
                            <Wifi size={12} />
                            <span className="text-xs">online</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-red-400">
                            <WifiOff size={12} />
                            <span className="text-xs">offline</span>
                          </div>
                        )}
                      </div>

                      {/* Último heartbeat */}
                      <div className="w-24 text-right">
                        <div className="flex items-center justify-end gap-1 text-white/30">
                          <Clock size={10} />
                          <span className="text-xs">{timeAgo(c.ultimoHeartbeat)}</span>
                        </div>
                      </div>

                      {/* Botão de atualização rápida */}
                      {hasAgent && isOutdated && latestVersion && (
                        <button
                          onClick={() => {
                            setTargetCnpj(c.cnpj.replace(/\D/g, ''))
                            setSelectedRelease(releases[0] ?? null)
                            setConfirmOpen(true)
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-yellow-400/10 border border-yellow-400/25 rounded-lg text-yellow-400 text-xs hover:bg-yellow-400/20 transition-colors"
                        >
                          <RefreshCw size={10} />
                          v{latestVersion}
                        </button>
                      )}
                      {(!hasAgent || isUpToDate) && <div className="w-16" />}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Info */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4">
          <p className="text-white/40 text-xs font-semibold mb-2 uppercase tracking-wider">Como funciona</p>
          <ol className="text-white/30 text-xs space-y-1.5 list-decimal list-inside">
            <li>Faça upload do novo executável compilado para Windows</li>
            <li>Selecione a versão e o destino (todos ou um cliente)</li>
            <li>O portal publica o comando <code className="text-green-400/60">UPDATE_AGENT</code> via MQTT</li>
            <li>O agente baixa, verifica o SHA256 e se substitui atomicamente</li>
            <li>O serviço Windows reinicia automaticamente com a nova versão</li>
          </ol>
        </div>

      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />

      {confirmOpen && selectedRelease && (
        <ConfirmModal
          title="Confirmar Atualização"
          message={
            <span>
              Enviar versão <strong className="text-white">v{selectedRelease.version}</strong> para{' '}
              <strong className="text-white">
                {targetCnpj === 'todos'
                  ? `todos os clientes ativos (${clientes.length})`
                  : (clientes.find(c => c.cnpj.replace(/\D/g, '') === targetCnpj)?.clienteNome ?? targetCnpj)}
              </strong>?
              <span className="text-white/40 text-xs mt-1 block">
                O agente baixará e aplicará a atualização automaticamente.
              </span>
            </span>
          }
          confirmLabel="Enviar Atualização"
          onConfirm={doDispatch}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
