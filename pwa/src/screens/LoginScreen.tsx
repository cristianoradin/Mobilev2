import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import type { UserSession } from '@/lib/contracts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function apiLogin(email: string, senha: string): Promise<UserSession> {
  const res = await fetch(`${API_URL}/api/auth/pwa-login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, senha }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao fazer login')
  return data as UserSession
}

export function LoginScreen() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [email, setEmail]   = useState('')
  const [senha, setSenha]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!email.trim() || !senha.trim()) { setError('Preencha e-mail e senha'); return }
      const session = await apiLogin(email, senha)
      await login(session)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 transition-colors duration-200">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <img
          src="/logo-vertical.png"
          alt="SGA Petro"
          className="h-32 w-auto object-contain"
        />
        <p className="text-sm text-ink/50">Gestão inteligente do seu posto</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink/50 mb-2 uppercase tracking-wider">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com.br"
            autoComplete="email"
            className="w-full bg-surface border border-rim rounded-xl px-4 py-3.5 text-ink placeholder:text-ink/30 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink/50 mb-2 uppercase tracking-wider">
            Senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full bg-surface border border-rim rounded-xl px-4 py-3.5 text-ink placeholder:text-ink/30 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-semibold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Entrando...
            </span>
          ) : 'Entrar'}
        </button>
      </form>

      <p className="text-ink/20 text-xs mt-8">
        SGA Petro v1.0.0 — Tecnologia proprietária
      </p>
    </div>
  )
}
