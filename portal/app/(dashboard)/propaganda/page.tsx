'use client'
import { useState, useEffect, useRef } from 'react'
import { TopBar }         from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Button }         from '@/components/ui/Button'
import { Badge }          from '@/components/ui/Badge'
import { useToast, Toaster } from '@/components/ui/Toast'
import {
  Megaphone, Upload, X, Globe, Users, Clock, Trash2,
  ToggleLeft, ToggleRight, ImageIcon, Send, Eye, EyeOff,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Cliente { id: string; nome: string; ativo: boolean }

interface PropagandaRow {
  id:           string
  titulo:       string
  descricao:    string
  imagem:       string | null
  clienteIds:   string[] | null
  paraTodos:    boolean
  duracaoHoras: number
  ativa:        boolean
  createdAt:    string
  expiresAt:    string | null
}

const DURACOES = [
  { label: '6 horas',   value: 6    },
  { label: '12 horas',  value: 12   },
  { label: '24 horas',  value: 24   },
  { label: '2 dias',    value: 48   },
  { label: '3 dias',    value: 72   },
  { label: '7 dias',    value: 168  },
  { label: '15 dias',   value: 360  },
  { label: '30 dias',   value: 720  },
]

// Redimensiona imagem client-side para 800×400 JPEG ~85%
async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const TARGET_W = 800, TARGET_H = 400
      let w = img.width, h = img.height
      const ratio = Math.min(TARGET_W / w, TARGET_H / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
      const canvas = document.createElement('canvas')
      canvas.width  = TARGET_W
      canvas.height = TARGET_H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, TARGET_W, TARGET_H)
      ctx.drawImage(img, (TARGET_W - w) / 2, (TARGET_H - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function PropagandaPage() {
  const { toasts, toast, dismiss } = useToast()
  const dropRef = useRef<HTMLDivElement>(null)

  // Form
  const [titulo,       setTitulo]       = useState('')
  const [descricao,    setDescricao]    = useState('')
  const [imagem,       setImagem]       = useState<string | null>(null)
  const [clienteId,    setClienteId]    = useState<string>('todos')
  const [duracao,      setDuracao]      = useState(24)
  const [enviarPush,   setEnviarPush]   = useState(true)
  const [isDragging,   setIsDragging]   = useState(false)
  const [salvando,     setSalvando]     = useState(false)
  const [previewPush,  setPreviewPush]  = useState(false)

  // Data
  const [clientes,    setClientes]    = useState<Cliente[]>([])
  const [lista,       setLista]       = useState<PropagandaRow[]>([])
  const [carregando,  setCarregando]  = useState(true)
  const [deletando,   setDeletando]   = useState<string | null>(null)
  const [toggling,    setToggling]    = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes').then(r => r.json()),
      fetch('/api/propaganda').then(r => r.json()),
    ])
      .then(([cData, pData]: [{ clientes: Cliente[] }, { propagandas: PropagandaRow[] }]) => {
        setClientes((cData.clientes ?? []).filter(c => c.ativo))
        setLista(pData.propagandas ?? [])
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  // ── Upload de imagem ────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast('Arquivo deve ser uma imagem', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Imagem muito grande (máx 10MB)', 'error'); return }
    try {
      const b64 = await resizeImage(file)
      setImagem(b64)
    } catch {
      toast('Erro ao processar imagem', 'error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!titulo.trim()) { toast('Informe o título', 'error'); return }
    setSalvando(true)
    try {
      const paraT      = clienteId === 'todos'
      const clienteIds = paraT ? [] : [clienteId]

      const res = await fetch('/api/propaganda', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo:        titulo.trim(),
          descricao:     descricao.trim(),
          imagem,
          cliente_ids:   clienteIds,
          para_todos:    paraT,
          duracao_horas: duracao,
          enviar_push:   enviarPush,
        }),
      })
      const data = await res.json() as { ok?: boolean; push_sent?: number; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro ao salvar', 'error'); return }

      toast(
        enviarPush && (data.push_sent ?? 0) > 0
          ? `Propaganda criada · push enviado para ${data.push_sent} dispositivo(s)`
          : 'Propaganda criada com sucesso',
        'success'
      )
      setTitulo(''); setDescricao(''); setImagem(null); setClienteId('todos')
      setDuracao(24); setEnviarPush(true)

      // Recarrega lista
      fetch('/api/propaganda').then(r => r.json())
        .then((d: { propagandas: PropagandaRow[] }) => setLista(d.propagandas ?? []))
        .catch(() => {})
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtiva(p: PropagandaRow) {
    setToggling(p.id)
    await fetch(`/api/propaganda/${p.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativa: !p.ativa }),
    }).catch(() => {})
    setLista(prev => prev.map(x => x.id === p.id ? { ...x, ativa: !x.ativa } : x))
    setToggling(null)
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta propaganda? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await fetch(`/api/propaganda/${id}`, { method: 'DELETE' }).catch(() => {})
    setLista(prev => prev.filter(x => x.id !== id))
    setDeletando(null)
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function isExpired(p: PropagandaRow) {
    return p.expiresAt ? new Date(p.expiresAt) < new Date() : false
  }

  const clienteNome = clienteId !== 'todos'
    ? clientes.find(c => c.id === clienteId)?.nome ?? 'Cliente'
    : null

  return (
    <div>
      <TopBar
        title="Propaganda"
        subtitle={`${lista.filter(p => p.ativa && !isExpired(p)).length} ativa(s) · ${lista.length} total`}
      />

      <div className="p-8 grid grid-cols-[420px_1fr] gap-6 items-start">

        {/* ── FORMULÁRIO ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
                  <Megaphone size={15} className="text-[#009c3b]" />
                </div>
                <p className="text-white font-semibold text-sm">Nova Propaganda</p>
              </div>

              {/* Upload de imagem */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">
                  Imagem <span className="text-white/25">(recomendado 800×400px · 2:1)</span>
                </label>
                {imagem ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagem} alt="preview" className="w-full h-40 object-cover" />
                    <button
                      onClick={() => setImagem(null)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={13} className="text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5 text-[10px] text-white/70">
                      800×400px · JPEG
                    </div>
                  </div>
                ) : (
                  <div
                    ref={dropRef}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('img-input')?.click()}
                    className={`relative h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                      ${isDragging
                        ? 'border-[#009c3b]/60 bg-[#009c3b]/5'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                      }`}
                  >
                    <ImageIcon size={28} className="text-white/20 mb-2" />
                    <p className="text-white/40 text-xs">Arraste ou clique para escolher</p>
                    <p className="text-white/20 text-[10px] mt-0.5">PNG, JPG, WEBP — máx 10MB</p>
                    <input
                      id="img-input" type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                  </div>
                )}
              </div>

              {/* Título */}
              <div className="mb-3">
                <label className="block text-white/50 text-xs mb-1.5">Título *</label>
                <input
                  value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={100}
                  placeholder="Ex: Promoção de Natal — 10% off"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/50 transition-all"
                />
                <p className="text-white/20 text-[10px] mt-1 text-right">{titulo.length}/100</p>
              </div>

              {/* Descrição */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Descrição</label>
                <textarea
                  value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Texto exibido abaixo do título no banner..." maxLength={300} rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/50 transition-all resize-none"
                />
                <p className="text-white/20 text-[10px] mt-1 text-right">{descricao.length}/300</p>
              </div>

              {/* Destinatário */}
              <div className="mb-3">
                <label className="block text-white/50 text-xs mb-1.5">Destinatário</label>
                <select
                  value={clienteId} onChange={e => setClienteId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-all"
                >
                  <option value="todos">🌐 Todos os clientes</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Duração */}
              <div className="mb-4">
                <label className="block text-white/50 text-xs mb-1.5">Exibir por</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DURACOES.map(d => (
                    <button
                      key={d.value} type="button"
                      onClick={() => setDuracao(d.value)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                        duracao === d.value
                          ? 'bg-[#009c3b]/80 text-white'
                          : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enviar push */}
              <div className="flex items-center justify-between mb-5 py-3 px-3 bg-white/[0.03] border border-white/8 rounded-xl">
                <div className="flex items-center gap-2">
                  <Send size={13} className="text-white/50" />
                  <span className="text-white/70 text-sm">Notificar via push</span>
                </div>
                <button
                  type="button" onClick={() => setEnviarPush(v => !v)}
                  className="transition-colors"
                >
                  {enviarPush
                    ? <ToggleRight size={26} className="text-[#009c3b]" />
                    : <ToggleLeft  size={26} className="text-white/25" />
                  }
                </button>
              </div>

              {/* Preview do banner */}
              {titulo && (
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => setPreviewPush(v => !v)}
                    className="flex items-center gap-1.5 text-[10px] text-white/35 hover:text-white/60 transition-colors mb-2"
                  >
                    {previewPush ? <EyeOff size={11} /> : <Eye size={11} />}
                    Preview do banner no mobile
                  </button>
                  {previewPush && (
                    <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#111]">
                      {imagem && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imagem} alt="banner" className="w-full h-28 object-cover" />
                      )}
                      <div className="p-4">
                        <p className="text-white font-bold text-sm leading-tight">{titulo}</p>
                        {descricao && (
                          <p className="text-white/50 text-xs mt-1 line-clamp-2">{descricao}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                            {clienteId === 'todos'
                              ? <><Globe size={9} />Todos os clientes</>
                              : <><Users size={9} />{clienteNome}</>
                            }
                          </div>
                          <span className="text-white/20 text-[10px]">·</span>
                          <div className="flex items-center gap-1 text-[10px] text-white/30">
                            <Clock size={9} />
                            {DURACOES.find(d => d.value === duracao)?.label ?? `${duracao}h`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button className="w-full justify-center" loading={salvando} disabled={!titulo.trim()} onClick={salvar}>
                <Upload size={14} />
                Publicar Propaganda
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ── LISTA ────────────────────────────────────────────────────────── */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">
            Propagandas Cadastradas
          </p>

          {carregando ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            </div>
          ) : lista.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-10 text-center">
                  <Megaphone size={30} className="text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Nenhuma propaganda cadastrada</p>
                  <p className="text-white/20 text-xs mt-1">Crie a primeira usando o formulário ao lado</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {lista.map(p => {
                const expired = isExpired(p)
                return (
                  <Card key={p.id} className={expired ? 'opacity-50' : ''}>
                    <CardBody>
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
                          {p.imagem
                            ? <img src={p.imagem} alt={p.titulo} className="w-full h-full object-cover" />
                            : <ImageIcon size={18} className="text-white/20" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap mb-1">
                            <p className="text-white font-semibold text-sm truncate max-w-[200px]">{p.titulo}</p>
                            {expired
                              ? <Badge variant="default">Expirada</Badge>
                              : p.ativa
                                ? <Badge variant="success">Ativa</Badge>
                                : <Badge variant="warning">Pausada</Badge>
                            }
                            {p.paraTodos
                              ? <Badge variant="info"><Globe size={9} className="mr-1" />Todos</Badge>
                              : <Badge variant="default"><Users size={9} className="mr-1" />{(p.clienteIds ?? []).length} cliente(s)</Badge>
                            }
                          </div>
                          {p.descricao && (
                            <p className="text-white/40 text-xs line-clamp-1 mb-1">{p.descricao}</p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-white/30 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock size={9} />
                              Criada: {fmtDate(p.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={9} />
                              Expira: {fmtDate(p.expiresAt)}
                            </span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => toggleAtiva(p)}
                            disabled={!!toggling || expired}
                            title={p.ativa ? 'Pausar' : 'Ativar'}
                            className={`p-2 rounded-lg transition-all ${
                              expired
                                ? 'text-white/15 cursor-not-allowed'
                                : p.ativa
                                  ? 'text-[#009c3b] hover:bg-[#009c3b]/10'
                                  : 'text-white/30 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {p.ativa
                              ? <ToggleRight size={18} />
                              : <ToggleLeft  size={18} />
                            }
                          </button>
                          <button
                            onClick={() => deletar(p.id)}
                            disabled={deletando === p.id}
                            title="Excluir"
                            className="p-2 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
