'use client'
import { useState, useEffect, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast, Toaster } from '@/components/ui/Toast'
import {
  Upload, RefreshCw, Send, Package, CheckCircle, Globe,
  Users, Cpu, FileCode,
} from 'lucide-react'

interface Release {
  filename: string
  version:  string
  os:       string
  arch:     string
  sha256:   string
  size:     number
  url:      string
}

interface Cliente {
  id:   string
  nome: string
  cnpj: string
  ativo: boolean
}

export default function AgentesPage() {
  const { toasts, toast, dismiss } = useToast()

  const [releases,   setReleases]   = useState<Release[]>([])
  const [clientes,   setClientes]   = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

  // Upload state
  const [uploading,  setUploading]  = useState(false)
  const [version,    setVersion]    = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const fileRef                     = useRef<HTMLInputElement>(null)

  // Update state
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [targetCnpj,      setTargetCnpj]      = useState<string>('todos')
  const [sending,         setSending]          = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/agent/release').then(r => r.json()),
      fetch('/api/clientes').then(r => r.json()),
    ])
      .then(([rel, cli]: [{ releases: Release[] }, { clientes: Cliente[] }]) => {
        setReleases(rel.releases ?? [])
        setClientes((cli.clientes ?? []).filter(c => c.ativo))
        // Seleciona automaticamente a release mais recente
        if (rel.releases?.[0]) setSelectedRelease(rel.releases[0])
      })
      .catch(() => toast('Erro ao carregar dados', 'error'))
      .finally(() => setCarregando(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      // Atualiza lista de releases
      const updated = await fetch('/api/agent/release').then(r => r.json()) as { releases: Release[] }
      setReleases(updated.releases ?? [])
      if (updated.releases?.[0]) setSelectedRelease(updated.releases[0])
    } catch {
      toast('Erro ao enviar arquivo', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDispatch() {
    if (!selectedRelease) { toast('Selecione uma versão para enviar', 'warning'); return }

    const target = targetCnpj === 'todos'
      ? `todos os clientes ativos (${clientes.length})`
      : clientes.find(c => c.cnpj.replace(/\D/g, '') === targetCnpj)?.nome ?? targetCnpj

    if (!confirm(`Enviar atualização ${selectedRelease.version} para ${target}?`)) return

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

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div>
      <TopBar
        title="Agentes"
        subtitle="Gerenciar e atualizar o agente local nos postos"
      />

      <div className="p-8 grid grid-cols-2 gap-6 items-start">

        {/* ── Coluna esq: Upload de binário + Disparar update ─────────────── */}
        <div className="space-y-5">

          {/* Upload de nova release */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
                  <Upload size={15} className="text-[#009c3b]" />
                </div>
                <p className="text-white font-semibold text-sm">Upload de Nova Versão</p>
              </div>

              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Versão</label>
                <input
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="ex: 1.1.0"
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
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".exe"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
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
                      <p className="text-white/25 text-xs mt-1">sga-agent-{version || 'x.x.x'}-windows-amd64.exe</p>
                    </>
                  )}
                </div>
              </div>

              <Button
                className="w-full justify-center"
                loading={uploading}
                disabled={!file || !version.trim()}
                onClick={handleUpload}
              >
                <Upload size={14} />Enviar Binário
              </Button>
            </CardBody>
          </Card>

          {/* Disparar atualização */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/25 rounded-lg flex items-center justify-center">
                  <Send size={15} className="text-blue-400" />
                </div>
                <p className="text-white font-semibold text-sm">Disparar Atualização</p>
              </div>

              {/* Seleciona versão */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Versão a instalar</label>
                {releases.length === 0 ? (
                  <p className="text-white/30 text-xs py-2">Nenhuma versão disponível — faça upload primeiro</p>
                ) : (
                  <select
                    value={selectedRelease?.filename ?? ''}
                    onChange={e => setSelectedRelease(releases.find(r => r.filename === e.target.value) ?? null)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all"
                  >
                    {releases.map(r => (
                      <option key={r.filename} value={r.filename}>
                        v{r.version} — {r.os}/{r.arch} ({formatBytes(r.size)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* SHA256 preview */}
              {selectedRelease && (
                <div className="bg-black/30 rounded-lg p-3 mb-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">SHA256</p>
                  <code className="text-green-400/70 text-[10px] font-mono break-all">
                    {selectedRelease.sha256}
                  </code>
                </div>
              )}

              {/* Seleciona destino */}
              <div className="mb-5">
                <label className="block text-white/50 text-xs mb-1.5">Enviar para</label>
                <select
                  value={targetCnpj}
                  onChange={e => setTargetCnpj(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all"
                >
                  <option value="todos">🌐 Todos os clientes ativos ({clientes.length})</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.cnpj.replace(/\D/g, '')}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full justify-center"
                loading={sending}
                disabled={!selectedRelease || clientes.length === 0}
                onClick={handleDispatch}
              >
                <RefreshCw size={14} />
                {targetCnpj === 'todos' ? 'Atualizar Todos' : 'Atualizar Cliente'}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ── Coluna dir: Versões disponíveis ─────────────────────────────── */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">
            Versões Disponíveis
          </p>

          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
          ) : releases.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-8 text-center">
                  <Package size={28} className="text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Nenhuma versão disponível</p>
                  <p className="text-white/20 text-xs mt-1">Faça upload de um binário para começar</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {releases.map((r, idx) => (
                <Card
                  key={r.filename}
                  className={selectedRelease?.filename === r.filename ? 'ring-1 ring-[#009c3b]/40' : ''}
                >
                  <CardBody>
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => setSelectedRelease(r)}
                    >
                      <div className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Cpu size={16} className="text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-semibold text-sm">v{r.version}</p>
                          {idx === 0 && <Badge variant="success">Mais recente</Badge>}
                          <Badge variant="default">{r.os}/{r.arch}</Badge>
                        </div>
                        <p className="text-white/40 text-xs mb-2">{r.filename}</p>
                        <div className="flex items-center gap-3 text-[10px] text-white/30">
                          <span>{formatBytes(r.size)}</span>
                          <span className="font-mono text-green-400/50 truncate max-w-[180px]">
                            {r.sha256.slice(0, 16)}…
                          </span>
                        </div>
                      </div>
                      {selectedRelease?.filename === r.filename && (
                        <CheckCircle size={16} className="text-[#009c3b] flex-shrink-0" />
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {/* Info sobre o fluxo */}
          <div className="mt-5 bg-white/3 border border-white/8 rounded-xl p-4">
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
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
