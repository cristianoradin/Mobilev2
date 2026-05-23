'use client'
import { useState, useRef } from 'react'
import {
  RefreshCw, ExternalLink, Home, TrendingUp, Fuel,
  DollarSign, Shield, Settings, ChevronLeft, ChevronRight,
  Smartphone, Monitor,
} from 'lucide-react'

// URL do PWA — mude em .env.local via NEXT_PUBLIC_PWA_URL
const PWA_URL = process.env.NEXT_PUBLIC_PWA_URL ?? 'http://localhost:5173'

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
  const iframeRef             = useRef<HTMLIFrameElement>(null)
  const [currentPath, setCurrentPath] = useState('/')
  const [inputPath, setInputPath]     = useState('/')
  const [viewMode, setViewMode]       = useState<ViewMode>('phone')
  const [key, setKey]                 = useState(0) // força re-mount do iframe

  function navigate(path: string) {
    setCurrentPath(path)
    setInputPath(path)
    // Navega dentro do iframe via postMessage (react-router responde ao NAVIGATE)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'NAVIGATE', route: path },
      PWA_URL
    )
  }

  function reload() {
    setKey(k => k + 1)
  }

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(inputPath)
  }

  const iframeUrl = `${PWA_URL}${currentPath}`

  const phoneSize  = { width: 390,  height: 844  } // iPhone 14 Pro
  const tabletSize = { width: 768,  height: 1024 } // iPad mini

  const { width, height } = viewMode === 'phone' ? phoneSize : tabletSize

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] overflow-hidden">
      {/* ── Toolbar ── */}
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
          href={iframeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          title="Abrir em nova aba"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* ── Frame area ── */}
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
            />
          </div>

          {/* Indicador de rota atual */}
          <div className="flex items-center gap-2 text-white/20 text-[10px]">
            <ChevronRight size={10} />
            <span className="font-mono">{currentPath}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
