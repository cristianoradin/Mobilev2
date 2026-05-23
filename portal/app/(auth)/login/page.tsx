'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Fuel, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao fazer login')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-[#009c3b] rounded-2xl flex items-center justify-center shadow-xl shadow-[#009c3b]/30 mb-4">
          <Fuel size={28} className="text-white" />
        </div>
        <h1 className="text-white font-bold text-2xl tracking-tight">SGA Petro</h1>
        <p className="text-white/40 text-sm mt-1">Portal Administrativo</p>
      </div>

      {/* Card */}
      <div className="bg-[#151515] border border-white/8 rounded-2xl p-8">
        <h2 className="text-white font-semibold text-lg mb-6">Entrar</h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@sgapetro.cloud"
              required
              autoComplete="email"
              className="w-full bg-white/4 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#009c3b]/60 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-white/4 border border-white/10 rounded-lg px-4 py-2.5 pr-11 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#009c3b]/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[#009c3b] hover:bg-[#00b548] disabled:bg-white/8 disabled:text-white/30 text-white font-semibold text-sm py-2.5 rounded-lg transition-all duration-150"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <LogIn size={15} />
            }
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="text-center text-white/20 text-xs mt-6">
        SGA Petro © {new Date().getFullYear()} — acesso restrito
      </p>
    </div>
  )
}
