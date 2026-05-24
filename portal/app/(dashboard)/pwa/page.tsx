'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  RefreshCw, ExternalLink, Home, TrendingUp, Fuel,
  DollarSign, Shield, Settings, ChevronLeft, ChevronRight,
  Smartphone, Monitor, LogIn, ChevronDown, Check,
} from 'lucide-react'
import type { Cliente, UserSession } from '@/lib/types'

// URL do PWA — configurável via NEXT_PUBLIC_PWA_URL; fallback = produção
const PWA_URL = process.env.NEXT_PUBLIC_PWA_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

const QUICK_ROUTES = [
  { label: 'Início',       path: '/',       icon: Home        },
  { label: 'Vendas',       path: '/vendas', icon: TrendingUp  },
  { label: 'Estoque',      path: '/estoque',icon: Fuel        },
  { label: 'Preço',        path: '/preco',  icon: DollarSign  },
  { label: 'Autorizações', path: '/auth',   icon: Shield      },
  { label: 'Config',       path: '/config', icon: Settings    },
]

type ViewMode = 'phone' | 'tablet'

export default function PwaPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [currentPath, setCurrentPath] = useState('/')
  const [inputPath,   setInputPath]   = useState('/')
  const [viewMode,    setViewMode]    = useState<ViewMode>('phone')
  const [key,         setKey]         = useState(0) // força re-mount do iframe

  // ── Cliente selecionado ──────────────────────────────────────────────────────
  const [clientes,    setClientes]   = useState<Cliente[]>([])
  const [clienteId,   setClienteId] = useState<string>('')
  const [clienteNome, setClienteNome] = useState<string>('Selecionar cliente')
  const [dropOpen,    setDropOpen]   = useState(false)
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')

  // Carrega lista de clientes ao montar
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then((data: { clientes: Cliente[] }) => {
        const list = data.clientes ?? []
        setClientes(list)
        // Pré-seleciona SGA Petro Sistemas ou o primeiro da lista
        const sga = list.find(c => c.nome.toLowerCase().includes('sga petro'))
          ?? list.find(c => c.nome.toLowerCase().includes('sga'))
          ?? list[0]
        if (sga) {
          setClienteId(sga.id)
          setClienteNome(sga.nome)
        }
      })
      .catch(() => {})
  }, [])

  // ── Navegação ────────────────────────────────────────────────────────────────
  function navigate(path: string) {
    setCurrentPath(path)
    setInputPath(path)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'NAVIGATE', route: path },
      PWA_URL
    )
  }

  function reload() {
    setLoginStatus('idle')
    setKey(k => k + 1)
  }

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(inputPath)
  }

  // ── Auto-login ───────────────────────────────────────────────────────────────
  const sendAutoLogin = useCallback(async (cId: string) => {
    if (!cId) return
    setLoginStatus('loading')
    try {
      const res = await fetch(`/api/pwa-preview/session?cliente_id=${cId}`)
      if (!res.ok) { setLoginStatus('err'); return }
      const session: UserSession = await res.json()
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AUTO_LOGIN', session },
        PWA_URL
      )
      setLoginStatus('ok')
    } catch {
      setLoginStatus('err')
    }
  }, [])

  // Dispara auto-login quando o iframe carrega (se já temos um cliente)
  function handleIframeLoad() {
    if (clienteId && loginStatus === 'idle') {
      sendAutoLogin(clienteId)
    }
  }

  // Ao trocar de cliente, recarrega o iframe e refaz o login
  function selectCliente(c: Cliente) {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setDropOpen(false)
    setLoginStatus('idle')
    setKey(k => k + 1) // re-monta iframe → handleIframeLoad vai disparar
  }

  // ── Tamanhos ─────────────────────────────────────────────────────────────────
  const phoneSize  = { width: 390,  height: 844  }
  const tabletSize = { width: 768,  height: 1024 }
  const { width, height } = viewMode === 'phone' ? phoneSize : tabletSize

  // ── Indicador de status de login ─────────────────────────────────────────────
  const loginIcon = loginStatus === 'loading'
    ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
    : loginStatus === 'ok'
    ? <Check size={12} className="text-[#009c3b]" />
    : loginStatus === 'err'
    ? <span className="text-red-400 text-xs">!</span>
    : <LogIn size={12} />

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] overflow-hidden" onClick={() => dropOpen && setDropOpen(false)}>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-[#111] border-b border-white/8 flex-shrink-0">
        {/* Título */}
        <div className="flex items-center gap-2 text-white/60 text-sm font-medium flex-shrink-0">
          <Smartphone size={15} className="text-[#009c3b]" />
          PWA Preview
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Botões nav */}
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
          title="Início"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={reload}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
          title="Recarregar"
        >
          <RefreshCw size={14} />
        </button>

        {/* URL bar */}
        <form onSubmit={handleInputSubmit} className="flex-1 max-w-sm">
          <div className="flex items-center bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-1.5 gap-2">
            <span className="text-white/25 text-xs font-mono flex-shrink-0 truncate max-w-[120px]">{PWA_URL}</span>
            <input
              value={inputPath}
              onChange={e => setInputPath(e.target.value)}
              className="flex-1 bg-transparent text-white/70 text-xs font-mono focus:outline-none focus:text-white min-w-0"
              placeholder="/rota"
            />
          </div>
        </form>

        {/* Quick nav */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {QUICK_ROUTES.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={label}
              className={`p-1.5 rounded-lg transition-all text-xs font-medium ${
                currentPath === path
                  ? 'bg-[#009c3b]/15 text-[#009c3b]'
                  : 'text-white/40 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Seletor de cliente + auto-login */}
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setDropOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-white/60 text-xs hover:border-white/20 hover:text-white transition-all"
          >
            <span className="flex items-center gap-1.5 text-white/40">{loginIcon}</span>
            <span className="max-w-[140px] truncate">{clienteNome}</span>
            <ChevronDown size={12} className="text-white/30" />
          </button>

          {dropOpen && clientes.length > 0 && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-[10px] text-white/30 uppercase tracking-wider border-b border-white/5">
                Login automático como
              </div>
              <div className="max-h-52 overflow-y-auto">
                {clientes.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCliente(c)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5 transition-all ${
                      c.id === clienteId ? 'text-[#009c3b]' : 'text-white/60'
                    }`}
                  >
                    {c.id === clienteId && <Check size={12} className="flex-shrink-0" />}
                    {c.id !== clienteId && <span className="w-3" />}
                    <span className="truncate">{c.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Tamanho da tela */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setViewMode('phone')}
            title="Celular (390×844)"
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'phone'
                ? 'bg-[#009c3b]/15 text-[#009c3b]'
                : 'text-white/40 hover:text-white hover:bg-white/8'
            }`}
          >
            <Smartphone size={15} />
          </button>
          <button
            onClick={() => setViewMode('tablet')}
            title="Tablet (768×1024)"
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'tablet'
                ? 'bg-[#009c3b]/15 text-[#009c3b]'
                : 'text-white/40 hover:text-white hover:bg-white/8'
            }`}
          >
            <Monitor size={15} />
          </button>
        </div>

        {/* Abrir em nova aba */}
        <a
          href={`${PWA_URL}${currentPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          title="Abrir em nova aba"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* ── Frame area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-auto py-6">
        <div className="flex flex-col items-center gap-3">
          {/* Dimensões */}
          <div className="text-white/20 text-[10px] font-mono">
            {width} × {height}px — {viewMode === 'phone' ? 'iPhone 14 Pro' : 'iPad mini'}
          </div>

          {/* Moldura do dispositivo */}
          <div
            className="relative rounded-[36px] border-[6px] border-white/15 shadow-2xl shadow-black/60 bg-black overflow-hidden flex-shrink-0"
            style={{ width: width + 12, height: height + 12 }}
          >
            {/* Notch / Dynamic Island (phone only) */}
            {viewMode === 'phone' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10" />
            )}

            <iframe
              key={key}
              ref={iframeRef}
              src={`${PWA_URL}${currentPath}`}
              width={width}
              height={height}
              className="border-0 bg-[#0a0a0a]"
              title="SGA Petro PWA"
              allow="notifications; clipboard-read; clipboard-write"
              onLoad={handleIframeLoad}
            />
          </div>

          {/* Indicador de rota atual + status de login */}
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5 text-white/20">
              <ChevronRight size={10} />
              <span className="font-mono">{currentPath}</span>
            </div>
            {loginStatus === 'ok' && (
              <div className="flex items-center gap-1 text-[#009c3b]/60">
                <Check size={10} />
                <span>logado como {clienteNome}</span>
              </div>
            )}
            {loginStatus === 'err' && (
              <div className="flex items-center gap-1 text-red-400/60">
                <span>falha no login automático</span>
                <button
                  onClick={() => sendAutoLogin(clienteId)}
                  className="underline hover:text-red-400 transition-colors"
                >
                  tentar de novo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
