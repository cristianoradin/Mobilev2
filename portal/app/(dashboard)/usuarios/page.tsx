'use client'
import { useState, useEffect } from 'react'
import { TopBar }              from '@/components/layout/TopBar'
import { Card, CardBody }      from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'
import { useToast, Toaster }   from '@/components/ui/Toast'
import {
  UserCog, Plus, X, Trash2, Key, Shield, CheckSquare, Square, Eye, EyeOff,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PortalUser {
  id:               string
  email:            string
  nome:             string
  isMaster:         boolean
  menusPermitidos:  string[]
  ativo:            boolean
  createdAt:        string
}

// ─── Mapa de menus disponíveis ────────────────────────────────────────────────
const MENUS = [
  { key: 'dashboard',   label: 'Visão Geral'  },
  { key: 'dashboards',  label: 'Dashboards'   },
  { key: 'clientes',    label: 'Clientes'     },
  { key: 'graficos',    label: 'Gráficos'     },
  { key: 'licencas',    label: 'Licenças'     },
  { key: 'auditoria',   label: 'Auditoria'    },
  { key: 'comunicados', label: 'Comunicados'  },
  { key: 'propaganda',  label: 'Propaganda'   },
  { key: 'agentes',     label: 'Agentes'      },
  { key: 'pwa',         label: 'PWA'          },
  { key: 'usuarios',    label: 'Usuários'     },
  { key: 'configuracoes', label: 'Configurações' },
]

// ─── Modal de criação / edição ────────────────────────────────────────────────
function UserModal({
  user, onClose, onSaved,
}: {
  user:    PortalUser | null  // null = novo
  onClose: () => void
  onSaved: (u: PortalUser) => void
}) {
  const { toast } = useToast()
  const isNew = !user

  const [nome,    setNome]    = useState(user?.nome  ?? '')
  const [email,   setEmail]   = useState(user?.email ?? '')
  const [senha,   setSenha]   = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [menus,   setMenus]   = useState<string[]>(user?.menusPermitidos ?? [])
  const [saving,  setSaving]  = useState(false)

  function toggleMenu(key: string) {
    setMenus(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
  }

  function toggleAll() {
    setMenus(menus.length === MENUS.length ? [] : MENUS.map(m => m.key))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !email.trim()) { toast('Nome e e-mail obrigatórios', 'error'); return }
    if (isNew && !senha.trim())        { toast('Senha obrigatória para novo usuário', 'error'); return }

    setSaving(true)
    try {
      let res: Response
      if (isNew) {
        res = await fetch('/api/portal-usuarios', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, email, senha, menus_permitidos: menus }),
        })
      } else {
        const body: Record<string, unknown> = { nome, menus_permitidos: menus }
        if (senha.trim()) body.senha = senha
        res = await fetch(`/api/portal-usuarios/${user!.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      const data = await res.json() as { ok?: boolean; usuario?: PortalUser; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro ao salvar', 'error'); return }

      toast(isNew ? 'Usuário criado com sucesso' : 'Usuário atualizado', 'success')
      if (data.usuario) onSaved(data.usuario)
      else              onClose()
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
              <UserCog size={15} className="text-[#009c3b]" />
            </div>
            <p className="text-white font-semibold text-sm">
              {isNew ? 'Novo Usuário' : 'Editar Usuário'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X size={15} className="text-white/50" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Nome *</label>
            <input
              value={nome} onChange={e => setNome(e.target.value)} required
              placeholder="Nome completo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/50 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-white/50 text-xs mb-1.5">E-mail *</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              disabled={!isNew}
              placeholder="usuario@empresa.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-white/50 text-xs mb-1.5">
              Senha {!isNew && <span className="text-white/25">(deixe vazio para não alterar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={senha} onChange={e => setSenha(e.target.value)}
                placeholder={isNew ? 'Senha de acesso' : '••••••••'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/50 transition-all"
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Menus */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/50 text-xs">Menus permitidos</label>
              <button
                type="button" onClick={toggleAll}
                className="text-[10px] text-[#009c3b] hover:text-[#00c44a] transition-colors"
              >
                {menus.length === MENUS.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] border border-white/8 rounded-xl p-3">
              {MENUS.map(m => {
                const checked = menus.includes(m.key)
                return (
                  <button
                    key={m.key} type="button"
                    onClick={() => toggleMenu(m.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                      checked
                        ? 'bg-[#009c3b]/15 text-[#009c3b] border border-[#009c3b]/20'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {checked
                      ? <CheckSquare size={12} className="flex-shrink-0" />
                      : <Square      size={12} className="flex-shrink-0" />
                    }
                    {m.label}
                  </button>
                )
              })}
            </div>
            <p className="text-white/25 text-[10px] mt-1.5">
              {menus.length} de {MENUS.length} menus selecionados
            </p>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
            >
              Cancelar
            </button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              {isNew ? 'Criar Usuário' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de redefinir senha ─────────────────────────────────────────────────
function ResetSenhaModal({ user, onClose }: { user: PortalUser; onClose: () => void }) {
  const { toast } = useToast()
  const [senha,  setSenha]  = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!senha.trim() || senha.length < 6) { toast('Mínimo 6 caracteres', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`/api/portal-usuarios/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro', 'error'); return }
      toast('Senha redefinida', 'success')
      onClose()
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500/15 border border-amber-500/25 rounded-lg flex items-center justify-center">
              <Key size={14} className="text-amber-400" />
            </div>
            <p className="text-white font-semibold text-sm">Redefinir Senha</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X size={15} className="text-white/50" />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <p className="text-white/50 text-sm">
            Nova senha para <span className="text-white font-medium">{user.email}</span>
          </p>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={senha} onChange={e => setSenha(e.target.value)} required minLength={6}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 transition-all"
            />
            <button
              type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
              Cancelar
            </button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">
              Redefinir
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { toasts, toast, dismiss } = useToast()

  const [usuarios,   setUsuarios]   = useState<PortalUser[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalNew,   setModalNew]   = useState(false)
  const [editUser,   setEditUser]   = useState<PortalUser | null>(null)
  const [resetUser,  setResetUser]  = useState<PortalUser | null>(null)
  const [deletando,  setDeletando]  = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal-usuarios')
      .then(r => r.json())
      .then((d: { usuarios: PortalUser[] }) => setUsuarios(d.usuarios ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function onSaved(u: PortalUser) {
    setUsuarios(prev => {
      const idx = prev.findIndex(x => x.id === u.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = u; return next }
      return [u, ...prev]
    })
    setModalNew(false)
    setEditUser(null)
  }

  async function deletar(u: PortalUser) {
    if (!confirm(`Remover ${u.nome}? Esta ação não pode ser desfeita.`)) return
    setDeletando(u.id)
    const res  = await fetch(`/api/portal-usuarios/${u.id}`, { method: 'DELETE' }).catch(() => null)
    const data = res ? await res.json() as { ok?: boolean; error?: string } : null
    if (data?.ok) {
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
      toast('Usuário removido', 'success')
    } else {
      toast(data?.error ?? 'Erro ao remover', 'error')
    }
    setDeletando(null)
  }

  async function toggleAtivo(u: PortalUser) {
    const res  = await fetch(`/api/portal-usuarios/${u.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !u.ativo }),
    }).catch(() => null)
    const data = res ? await res.json() as { ok?: boolean } : null
    if (data?.ok) setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x))
  }

  return (
    <div>
      <TopBar
        title="Usuários do Portal"
        subtitle={`${usuarios.length} usuário(s) cadastrado(s)`}
        actions={
          <Button onClick={() => setModalNew(true)}>
            <Plus size={14} />
            Novo Usuário
          </Button>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {usuarios.map(u => (
              <Card key={u.id}>
                <CardBody>
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      u.isMaster
                        ? 'bg-[#009c3b]/20 text-[#009c3b] border border-[#009c3b]/30'
                        : 'bg-white/8 text-white/60 border border-white/10'
                    }`}>
                      {u.nome.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-semibold text-sm">{u.nome}</p>
                        {u.isMaster && (
                          <Badge variant="success">
                            <Shield size={9} className="mr-1" />Master
                          </Badge>
                        )}
                        {!u.ativo && <Badge variant="default">Inativo</Badge>}
                      </div>
                      <p className="text-white/40 text-xs">{u.email}</p>
                      {!u.isMaster && (
                        <p className="text-white/25 text-[10px] mt-0.5">
                          {u.menusPermitidos.length === 0
                            ? 'Sem acesso a menus'
                            : `${u.menusPermitidos.length} menu(s): ${u.menusPermitidos.join(', ')}`
                          }
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Editar */}
                      <button
                        onClick={() => setEditUser(u)}
                        title="Editar"
                        className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
                      >
                        <UserCog size={15} />
                      </button>
                      {/* Redefinir senha */}
                      <button
                        onClick={() => setResetUser(u)}
                        title="Redefinir senha"
                        className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      >
                        <Key size={14} />
                      </button>
                      {/* Ativar/inativar */}
                      {!u.isMaster && (
                        <button
                          onClick={() => toggleAtivo(u)}
                          title={u.ativo ? 'Inativar' : 'Ativar'}
                          className={`p-2 rounded-lg transition-all text-xs font-medium ${
                            u.ativo
                              ? 'text-white/30 hover:text-white hover:bg-white/8'
                              : 'text-[#009c3b]/60 hover:text-[#009c3b] hover:bg-[#009c3b]/10'
                          }`}
                        >
                          {u.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                      )}
                      {/* Deletar */}
                      {!u.isMaster && (
                        <button
                          onClick={() => deletar(u)}
                          disabled={deletando === u.id}
                          title="Remover"
                          className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}

            {usuarios.length === 0 && (
              <Card>
                <CardBody>
                  <div className="py-10 text-center">
                    <UserCog size={30} className="text-white/15 mx-auto mb-3" />
                    <p className="text-white/30 text-sm">Nenhum usuário cadastrado</p>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      {modalNew  && <UserModal user={null}    onClose={() => setModalNew(false)} onSaved={onSaved} />}
      {editUser  && <UserModal user={editUser} onClose={() => setEditUser(null)}  onSaved={onSaved} />}
      {resetUser && <ResetSenhaModal user={resetUser} onClose={() => setResetUser(null)} />}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
