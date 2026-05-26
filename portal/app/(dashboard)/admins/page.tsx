'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar }              from '@/components/layout/TopBar'
import { Card, CardHeader }    from '@/components/ui/Card'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { Input }               from '@/components/ui/Input'
import { ConfirmModal }        from '@/components/ui/ConfirmModal'
import {
  Plus, RefreshCw, Trash2, KeyRound, AlertTriangle, Shield, Loader2, Power, PowerOff, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface Admin {
  id: string; email: string; nome: string; ativo: boolean; createdAt: string
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminsPage() {
  const [admins,  setAdmins]  = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<Admin | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Admin | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Admin | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admins')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ admins: Admin[] }>
      })
      .then(d => setAdmins(d.admins ?? []))
      .catch(() => setError('Falha ao carregar lista de admins'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen">
      <TopBar
        title="Admins do Portal"
        subtitle="Gerencie quem pode acessar este portal admin"
        actions={
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <Plus size={14} />
              Novo admin
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={20} />
            <div className="flex-1 text-white/80 text-sm">{error}</div>
            <Button size="sm" variant="secondary" onClick={load}>Tentar novamente</Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Shield size={14} />
                {admins.length} admin(s) cadastrado(s)
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs">
                  <th className="px-6 py-3 text-left font-medium">Nome</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Criado em</th>
                  <th className="px-6 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-white/30">
                    <Loader2 size={20} className="animate-spin inline mr-2" />
                    Carregando…
                  </td></tr>
                )}
                {!loading && admins.length === 0 && !error && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-white/30">
                    Nenhum admin cadastrado
                  </td></tr>
                )}
                {!loading && admins.map(a => (
                  <tr key={a.id} className={cn('border-b border-white/5 hover:bg-white/2', !a.ativo && 'opacity-50')}>
                    <td className="px-6 py-3 text-white/90 font-medium">{a.nome}</td>
                    <td className="px-6 py-3 text-white/70 font-mono text-xs">{a.email}</td>
                    <td className="px-6 py-3">
                      {a.ativo
                        ? <Badge variant="success">Ativo</Badge>
                        : <Badge variant="default">Inativo</Badge>}
                    </td>
                    <td className="px-6 py-3 text-white/40 text-xs">{fmtData(a.createdAt)}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setResetting(a)}
                          className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-blue-400"
                          title="Redefinir senha"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmToggle(a)}
                          className={cn('p-1.5 rounded hover:bg-white/5 text-white/40',
                            a.ativo ? 'hover:text-amber-400' : 'hover:text-emerald-400'
                          )}
                          title={a.ativo ? 'Desativar' : 'Reativar'}
                        >
                          {a.ativo ? <PowerOff size={14} /> : <Power size={14} />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a)}
                          className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="text-white/30 text-xs">
          ⚠️ Você não pode desativar nem excluir seu próprio acesso. Outro admin precisa fazer isso.
        </div>
      </div>

      {/* ── Modal: criar novo admin ── */}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load() }}
        />
      )}

      {/* ── Modal: redefinir senha ── */}
      {resetting && (
        <ResetPasswordModal
          admin={resetting}
          onClose={() => setResetting(null)}
          onDone={() => { setResetting(null); load() }}
        />
      )}

      {/* ── Confirmação: toggle ativo ── */}
      {confirmToggle && (
        <ConfirmModal
          title={confirmToggle.ativo ? 'Desativar admin?' : 'Reativar admin?'}
          message={confirmToggle.ativo
            ? `${confirmToggle.nome} não conseguirá mais entrar no portal.`
            : `${confirmToggle.nome} poderá entrar no portal novamente.`}
          confirmLabel={confirmToggle.ativo ? 'Desativar' : 'Reativar'}
          variant={confirmToggle.ativo ? 'danger' : 'default'}
          onConfirm={async () => {
            await fetch(`/api/admins/${confirmToggle.id}`, {
              method:  'PATCH',
              headers: { 'content-type': 'application/json' },
              body:    JSON.stringify({ ativo: !confirmToggle.ativo }),
            })
            setConfirmToggle(null)
            load()
          }}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      {/* ── Confirmação: excluir ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Excluir admin?"
          message={`${confirmDelete.nome} (${confirmDelete.email}) será removido permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={async () => {
            const r = await fetch(`/api/admins/${confirmDelete.id}`, { method: 'DELETE' })
            if (!r.ok) {
              const j = await r.json().catch(() => ({}))
              alert(j.error ?? 'Falha ao excluir')
            }
            setConfirmDelete(null)
            load()
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// ── Modal: Criar admin ────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome]   = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  async function submit() {
    setErr(null); setBusy(true)
    try {
      const r = await fetch('/api/admins', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ nome, email, senha }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? `HTTP ${r.status}`); return }
      onCreated()
    } catch { setErr('Erro de rede') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-white/10 rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Novo admin do portal</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs">Nome</label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Maria Silva" />
          </div>
          <div>
            <label className="text-white/50 text-xs">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@sgapetro.cloud" />
          </div>
          <div>
            <label className="text-white/50 text-xs">Senha (6+ caracteres)</label>
            <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" />
          </div>
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button variant="primary" onClick={submit} disabled={busy || !nome || !email || senha.length < 6}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Reset password ─────────────────────────────────────────────────────
function ResetPasswordModal({ admin, onClose, onDone }: { admin: Admin; onClose: () => void; onDone: () => void }) {
  const [senha, setSenha] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  async function submit() {
    setErr(null); setBusy(true)
    try {
      const r = await fetch(`/api/admins/${admin.id}/senha`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ senha }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? `HTTP ${r.status}`); return }
      onDone()
    } catch { setErr('Erro de rede') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-white/10 rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Redefinir senha de {admin.nome}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="text-white/50 text-xs bg-white/5 rounded p-3">
            Email: <span className="text-white/80 font-mono">{admin.email}</span>
          </div>
          <div>
            <label className="text-white/50 text-xs">Nova senha (6+ caracteres)</label>
            <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" />
          </div>
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button variant="primary" onClick={submit} disabled={busy || senha.length < 6}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Redefinir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
