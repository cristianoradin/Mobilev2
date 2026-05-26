'use client'
import { useState, useEffect, useMemo } from 'react'
import { TopBar }          from '@/components/layout/TopBar'
import { Card, CardBody }  from '@/components/ui/Card'
import { Button }          from '@/components/ui/Button'
import { Badge }           from '@/components/ui/Badge'
import { Input }           from '@/components/ui/Input'
import { MultiPicker }     from '@/components/ui/MultiPicker'
import { useToast, Toaster } from '@/components/ui/Toast'
import {
  Users, Plus, X, Eye, EyeOff, Key, Trash2,
  UserCog, CheckSquare, Square, Search, Building2,
  ShieldCheck, Clock,
} from 'lucide-react'
import type { UserRole, Cliente } from '@/lib/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UsuarioGlobal {
  id:          string
  clienteId:   string
  clienteNome: string
  clienteCnpj: string
  email:       string
  nome:        string
  telefone:    string
  role:        UserRole
  ativo:       boolean
  ultimoLogin: string | null
  createdAt:   string
  empresas:    { id: number; nome: string }[]
}

interface EmpresaSimples { id: number; nome: string }
interface ClienteSimples { id: string; nome: string; empresas: EmpresaSimples[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<UserRole, string> = {
  operador: 'Operador',
  gerente:  'Gerente',
  dono:     'Dono',
}
const ROLE_VARIANT: Record<UserRole, 'default' | 'info' | 'success'> = {
  operador: 'default',
  gerente:  'info',
  dono:     'success',
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s atrás`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ─── Modal de criar / editar ──────────────────────────────────────────────────
function UsuarioModal({
  usuario, clientes, onClose, onSaved,
}: {
  usuario:  UsuarioGlobal | null   // null = novo
  clientes: ClienteSimples[]
  onClose:  () => void
  onSaved:  (u: UsuarioGlobal) => void
}) {
  const { toast }  = useToast()
  const isNew      = !usuario

  const [nome,       setNome]       = useState(usuario?.nome      ?? '')
  const [email,      setEmail]      = useState(usuario?.email     ?? '')
  const [telefone,   setTelefone]   = useState(usuario?.telefone  ?? '')
  const [senha,      setSenha]      = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [role,       setRole]       = useState<UserRole>(usuario?.role ?? 'operador')
  const [clienteId,  setClienteId]  = useState(usuario?.clienteId ?? '')
  const [empresaIds, setEmpresaIds] = useState<number[]>(usuario?.empresas.map(e => e.id) ?? [])
  const [saving,     setSaving]     = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)

  // Empresas do cliente selecionado
  const empresasCliente: EmpresaSimples[] = useMemo(() => {
    const c = clientes.find(c => c.id === clienteId)
    return c?.empresas ?? []
  }, [clientes, clienteId])

  // Ao trocar cliente, limpa empresas selecionadas e pré-seleciona se só há 1
  function handleClienteChange(id: string) {
    setClienteId(id)
    const c = clientes.find(c => c.id === id)
    setEmpresaIds(c?.empresas.length === 1 ? [c.empresas[0].id] : [])
  }

  function toggleEmpresa(id: number) {
    setEmpresaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleTodasEmpresas() {
    setEmpresaIds(prev =>
      prev.length === empresasCliente.length ? [] : empresasCliente.map(e => e.id)
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim())  { setErro('Nome obrigatório'); return }
    if (!email.trim()) { setErro('E-mail obrigatório'); return }
    if (isNew && !clienteId) { setErro('Selecione o cliente'); return }
    if (isNew && !senha.trim()) { setErro('Senha obrigatória'); return }
    if (senha && senha.length < 6) { setErro('Senha mínima: 6 caracteres'); return }

    setSaving(true)
    try {
      let res: Response

      if (isNew) {
        res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_id: clienteId, nome, email, telefone, role, senha, empresa_ids: empresaIds }),
        })
      } else {
        res = await fetch(`/api/usuarios/${usuario!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome, telefone, role,
            ...(senha ? { senha } : {}),
            empresa_ids: empresaIds,
          }),
        })
      }

      const data = await res.json() as { usuario?: UsuarioGlobal; ok?: boolean; error?: string }
      if (!res.ok) { setErro(data.error ?? 'Erro ao salvar'); return }

      toast(isNew ? 'Usuário criado!' : 'Usuário atualizado!', 'success')

      if (isNew && data.usuario) {
        onSaved(data.usuario as UsuarioGlobal)
      } else {
        // Para edição, reconstruímos o objeto localmente
        onSaved({
          ...usuario!,
          nome, telefone, role,
          empresas: empresasCliente.filter(e => empresaIds.includes(e.id)),
        })
      }
    } catch {
      setErro('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#111] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-lg flex items-center justify-center">
              <UserCog size={15} className="text-[#009c3b]" />
            </div>
            <p className="text-white font-semibold text-sm">
              {isNew ? 'Novo Usuário Mobile' : 'Editar Usuário'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X size={15} className="text-white/50" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Cliente — somente criação */}
          {isNew && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
                Cliente *
              </label>
              <select
                value={clienteId}
                onChange={e => handleClienteChange(e.target.value)}
                required
                className="w-full bg-white/4 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#009c3b]/60 transition-all"
              >
                <option value="">Selecione o cliente…</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Exibe cliente na edição (readonly) */}
          {!isNew && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/8 rounded-lg">
              <Building2 size={14} className="text-white/30 flex-shrink-0" />
              <span className="text-white/50 text-sm">{usuario!.clienteNome}</span>
            </div>
          )}

          {/* Nome */}
          <Input
            label="Nome *"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome completo"
            required
          />

          {/* Email — somente criação */}
          {isNew ? (
            <Input
              label="E-mail *"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@posto.com"
              required
            />
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">E-mail</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white/4 border border-white/8 rounded-lg text-white/40 text-sm">
                {usuario!.email}
              </div>
            </div>
          )}

          {/* Telefone */}
          <Input
            label="Telefone"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
          />

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Nível de acesso *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['operador', 'gerente', 'dono'] as UserRole[]).map(r => (
                <button
                  key={r} type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                    role === r
                      ? 'bg-[#009c3b]/15 text-[#009c3b] border-[#009c3b]/30'
                      : 'text-white/40 border-white/10 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
              Senha {!isNew && <span className="normal-case text-white/25">(vazio = não alterar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder={isNew ? 'Mínimo 6 caracteres' : '••••••••'}
                className="w-full bg-white/4 border border-white/10 rounded-lg px-3.5 py-2.5 pr-10 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#009c3b]/60 transition-all"
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Empresas — MultiPicker com search */}
          {empresasCliente.length > 0 && (
            <MultiPicker
              label="Postos / Filiais"
              placeholder="Buscar posto…"
              emptyMessage="Cliente sem postos cadastrados"
              maxHeight="280px"
              items={empresasCliente.map(e => ({ id: e.id, label: e.nome }))}
              selectedIds={empresaIds}
              onChange={ids => setEmpresaIds(ids as number[])}
            />
          )}

          {/* Erro */}
          {erro && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

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

// ─── Modal de resetar senha ───────────────────────────────────────────────────
function ResetSenhaModal({ usuario, onClose }: { usuario: UsuarioGlobal; onClose: () => void }) {
  const { toast } = useToast()
  const [senha,  setSenha]  = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) { toast('Mínimo 6 caracteres', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro', 'error'); return }
      toast('Senha redefinida!', 'success')
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
            Nova senha para <span className="text-white font-medium">{usuario.email}</span>
          </p>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={senha} onChange={e => setSenha(e.target.value)}
              required minLength={6}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full bg-white/4 border border-white/10 rounded-lg px-3.5 py-2.5 pr-10 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
              Cancelar
            </button>
            <Button type="submit" loading={saving} className="flex-1 justify-center">Redefinir</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { toasts, toast, dismiss } = useToast()

  const [usuarios,  setUsuarios]  = useState<UsuarioGlobal[]>([])
  const [clientes,  setClientes]  = useState<ClienteSimples[]>([])
  const [loading,   setLoading]   = useState(true)

  const [busca,          setBusca]          = useState('')
  const [filtroCliente,  setFiltroCliente]  = useState('')

  const [modalNovo,  setModalNovo]  = useState(false)
  const [editUser,   setEditUser]   = useState<UsuarioGlobal | null>(null)
  const [resetUser,  setResetUser]  = useState<UsuarioGlobal | null>(null)
  const [deletando,  setDeletando]  = useState<string | null>(null)

  // Carrega usuários + clientes em paralelo
  useEffect(() => {
    Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch('/api/clientes').then(r => r.json()),
    ])
      .then(([uData, cData]) => {
        setUsuarios((uData as { usuarios: UsuarioGlobal[] }).usuarios ?? [])
        const raw = (cData as { clientes: Cliente[] }).clientes ?? []
        setClientes(raw.map(c => ({
          id:       c.id,
          nome:     c.nome,
          empresas: (c.empresas ?? []).map(e => ({ id: Number(e.id), nome: e.nome })),
        })))
      })
      .catch(() => toast('Erro ao carregar dados', 'error'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtros locais
  const usuariosFiltrados = useMemo(() => {
    const q = busca.toLowerCase()
    return usuarios.filter(u => {
      const passaBusca   = !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const passaCliente = !filtroCliente || u.clienteId === filtroCliente
      return passaBusca && passaCliente
    })
  }, [usuarios, busca, filtroCliente])

  function onSaved(u: UsuarioGlobal) {
    setUsuarios(prev => {
      const idx = prev.findIndex(x => x.id === u.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = u; return next }
      return [u, ...prev]
    })
    setModalNovo(false)
    setEditUser(null)
  }

  async function toggleAtivo(u: UsuarioGlobal) {
    const res  = await fetch(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !u.ativo }),
    }).catch(() => null)
    const data = res ? await res.json() as { ok?: boolean } : null
    if (data?.ok) {
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !u.ativo } : x))
      toast(u.ativo ? 'Usuário inativado' : 'Usuário ativado', 'success')
    } else {
      toast('Erro ao atualizar status', 'error')
    }
  }

  async function deletar(u: UsuarioGlobal) {
    if (!confirm(`Remover permanentemente "${u.nome}" (${u.email})?\nEsta ação não pode ser desfeita.`)) return
    setDeletando(u.id)
    try {
      const res  = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data?.ok) {
        setUsuarios(prev => prev.filter(x => x.id !== u.id))
        toast('Usuário removido', 'success')
      } else {
        toast(data.error ?? 'Erro ao remover', 'error')
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setDeletando(null)
    }
  }

  const total   = usuarios.length
  const ativos  = usuarios.filter(u => u.ativo).length

  return (
    <div>
      <TopBar
        title="Usuários Mobile"
        subtitle={`${ativos} ativo(s) · ${total} total`}
        actions={
          <Button onClick={() => setModalNovo(true)}>
            <Plus size={14} />
            Novo Usuário
          </Button>
        }
      />

      <div className="p-8 space-y-5">
        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="w-full bg-white/4 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#009c3b]/60 transition-all"
            />
          </div>
          <select
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
            className="bg-white/4 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#009c3b]/60 transition-all min-w-[180px]"
          >
            <option value="">Todos os clientes</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}

        {/* Lista */}
        {!loading && (
          <div className="space-y-2">
            {usuariosFiltrados.map(u => (
              <Card key={u.id} className={u.ativo ? '' : 'opacity-50'}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      u.role === 'dono'
                        ? 'bg-[#009c3b]/20 text-[#009c3b] border border-[#009c3b]/30'
                        : u.role === 'gerente'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/8 text-white/60 border border-white/10'
                    }`}>
                      {u.nome.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: nome + role + ativo */}
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-semibold text-sm">{u.nome}</p>
                        <Badge variant={ROLE_VARIANT[u.role]}>
                          <ShieldCheck size={9} className="mr-1" />
                          {ROLE_LABEL[u.role]}
                        </Badge>
                        {!u.ativo && <Badge variant="default">Inativo</Badge>}
                      </div>

                      {/* Linha 2: email */}
                      <p className="text-white/40 text-xs">{u.email}</p>

                      {/* Linha 3: cliente + postos */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-white/30">
                          <Building2 size={10} />
                          {u.clienteNome}
                        </span>
                        {u.empresas.length > 0 && (
                          <span className="text-[11px] text-white/25">
                            {u.empresas.length === 1
                              ? u.empresas[0].nome
                              : `${u.empresas.length} postos`}
                          </span>
                        )}
                        {u.ultimoLogin && (
                          <span className="flex items-center gap-1 text-[11px] text-white/20">
                            <Clock size={9} />
                            {tempoRelativo(u.ultimoLogin)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditUser(u)} title="Editar"
                        className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
                      >
                        <UserCog size={14} />
                      </button>
                      <button
                        onClick={() => setResetUser(u)} title="Redefinir senha"
                        className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      >
                        <Key size={13} />
                      </button>
                      <button
                        onClick={() => toggleAtivo(u)}
                        title={u.ativo ? 'Inativar' : 'Ativar'}
                        className={`p-2 rounded-lg text-xs font-medium transition-all ${
                          u.ativo
                            ? 'text-white/30 hover:text-white hover:bg-white/8'
                            : 'text-[#009c3b]/60 hover:text-[#009c3b] hover:bg-[#009c3b]/10'
                        }`}
                      >
                        {u.ativo ? 'Inativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => deletar(u)}
                        disabled={deletando === u.id} title="Remover"
                        className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}

            {usuariosFiltrados.length === 0 && !loading && (
              <Card>
                <CardBody>
                  <div className="py-12 text-center">
                    <Users size={32} className="text-white/15 mx-auto mb-3" />
                    <p className="text-white/30 text-sm">
                      {busca || filtroCliente ? 'Nenhum usuário encontrado para os filtros' : 'Nenhum usuário cadastrado'}
                    </p>
                    {!busca && !filtroCliente && (
                      <button
                        onClick={() => setModalNovo(true)}
                        className="mt-3 text-[#009c3b] text-sm hover:text-[#00c44a] transition-colors"
                      >
                        Criar primeiro usuário
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      {modalNovo && (
        <UsuarioModal usuario={null} clientes={clientes} onClose={() => setModalNovo(false)} onSaved={onSaved} />
      )}
      {editUser && (
        <UsuarioModal usuario={editUser} clientes={clientes} onClose={() => setEditUser(null)} onSaved={onSaved} />
      )}
      {resetUser && (
        <ResetSenhaModal usuario={resetUser} onClose={() => setResetUser(null)} />
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
