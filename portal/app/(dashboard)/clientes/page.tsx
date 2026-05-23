'use client'
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { TopBar }  from '@/components/layout/TopBar'
import { Card }    from '@/components/ui/Card'
import { Badge }   from '@/components/ui/Badge'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { type Cliente, type Plano, type UserRole } from '@/lib/types'
import {
  Plus, Building2, Mail, Phone, ChevronRight,
  Key, BarChart3, X, Loader2, Users, Trash2, UserPlus,
} from 'lucide-react'

// ── Tipo local de usuário ─────────────────────────────────────────────────────
interface Usuario {
  id:           string
  nome:         string
  email:        string
  telefone?:    string
  role:         UserRole
  ativo:        boolean
  empresaIds:   number[]
  ultimoLogin:  string | null
  createdAt:    string
}

// ── helpers ──────────────────────────────────────────────────────────────────
const planoBadge: Record<string, 'success' | 'info' | 'purple'> = {
  basic:      'default' as 'success',
  pro:        'info',
  enterprise: 'purple',
}

const PLANOS: { value: Plano; label: string }[] = [
  { value: 'basic',      label: 'Basic'      },
  { value: 'pro',        label: 'Pro'        },
  { value: 'enterprise', label: 'Enterprise' },
]

// ── tipos do form ─────────────────────────────────────────────────────────────
interface FormState {
  nome:         string
  cnpj:         string
  email:        string
  telefone:     string
  plano:        Plano
  empresa_nome: string
  empresa_cnpj: string
}

const FORM_VAZIO: FormState = {
  nome: '', cnpj: '', email: '', telefone: '',
  plano: 'basic', empresa_nome: '', empresa_cnpj: '',
}

// ── componente ────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [clientes,    setClientes]    = useState<Cliente[]>([])
  const [carregando,  setCarregando]  = useState(true)

  const [selecionado,  setSelecionado]  = useState<Cliente | null>(null)
  const [gerandoToken, setGerandoToken] = useState(false)
  const [token,        setToken]        = useState<string | null>(null)

  const [modalAberto,  setModalAberto]  = useState(false)
  const [form,         setForm]         = useState<FormState>(FORM_VAZIO)
  const [salvando,     setSalvando]     = useState(false)
  const [erroForm,     setErroForm]     = useState<string | null>(null)

  // ── Usuários ────────────────────────────────────────────────────────────
  const [usuarios,          setUsuarios]          = useState<Usuario[]>([])
  const [carregandoUsers,   setCarregandoUsers]   = useState(false)
  const [modalUsuario,      setModalUsuario]      = useState(false)
  const [formUser,          setFormUser]          = useState({ nome: '', email: '', telefone: '', role: 'operador' as UserRole, senha: '', empresa_ids: [] as number[] })
  const [salvandoUser,      setSalvandoUser]      = useState(false)
  const [erroUser,          setErroUser]          = useState<string | null>(null)

  // Ao abrir o modal de usuário, pré-seleciona todos postos se só há 1
  function abrirModalUsuario() {
    const ids = selecionado?.empresas.length === 1 ? [selecionado.empresas[0].id] : []
    setFormUser({ nome: '', email: '', telefone: '', role: 'operador', senha: '', empresa_ids: ids })
    setErroUser(null)
    setModalUsuario(true)
  }

  function toggleEmpresa(id: number) {
    setFormUser(f => ({
      ...f,
      empresa_ids: f.empresa_ids.includes(id)
        ? f.empresa_ids.filter(x => x !== id)
        : [...f.empresa_ids, id],
    }))
  }

  // ── carrega usuários quando seleciona cliente ────────────────────────────
  const carregarUsuarios = useCallback(async (clienteId: string) => {
    setCarregandoUsers(true)
    try {
      const res  = await fetch(`/api/clientes/${clienteId}/usuarios`)
      const data = await res.json() as { usuarios: Usuario[] }
      setUsuarios(data.usuarios ?? [])
    } catch {
      setUsuarios([])
    } finally {
      setCarregandoUsers(false)
    }
  }, [])

  function selecionarCliente(cliente: Cliente) {
    setSelecionado(cliente)
    setToken(null)
    setUsuarios([])
    carregarUsuarios(cliente.id)
  }

  // ── salva novo usuário ───────────────────────────────────────────────────
  async function salvarUsuario(e: FormEvent) {
    e.preventDefault()
    if (!selecionado) return
    setErroUser(null)
    setSalvandoUser(true)
    try {
      if (formUser.empresa_ids.length === 0 && (selecionado.empresas.length > 0)) {
        setErroUser('Selecione pelo menos um posto')
        setSalvandoUser(false)
        return
      }
      const res = await fetch(`/api/clientes/${selecionado.id}/usuarios`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formUser),
      })
      const data = await res.json() as { usuario?: Usuario; error?: string }
      if (!res.ok) { setErroUser(data.error ?? 'Erro ao salvar'); return }
      if (data.usuario) setUsuarios(prev => [...prev, data.usuario!])
      setModalUsuario(false)
      setFormUser({ nome: '', email: '', telefone: '', role: 'operador', senha: '', empresa_ids: [] })
    } catch {
      setErroUser('Falha na comunicação com o servidor')
    } finally {
      setSalvandoUser(false)
    }
  }

  async function desativarUsuario(userId: string) {
    if (!selecionado) return
    if (!confirm('Desativar este usuário?')) return
    await fetch(`/api/clientes/${selecionado.id}/usuarios?usuario_id=${userId}`, { method: 'DELETE' })
    setUsuarios(prev => prev.filter(u => u.id !== userId))
  }

  // ── carrega clientes ──────────────────────────────────────────────────────
  const carregarClientes = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/clientes')
      const data = await res.json() as { clientes: Cliente[] }
      setClientes(data.clientes ?? [])
    } catch {
      // mantém lista vazia em caso de erro
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarClientes() }, [carregarClientes])

  // ── gera token do agente ──────────────────────────────────────────────────
  async function gerarToken(cliente: Cliente) {
    setGerandoToken(true)
    setToken(null)
    try {
      const res  = await fetch('/api/agent/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cliente_id: cliente.id }),
      })
      const data = await res.json() as { token: string }
      setToken(data.token)
    } catch {
      setToken('ERRO ao gerar token')
    } finally {
      setGerandoToken(false)
    }
  }

  // ── salva novo cliente ────────────────────────────────────────────────────
  async function salvarCliente(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    setSalvando(true)
    try {
      const res = await fetch('/api/clientes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json() as { cliente?: Cliente; error?: string }

      if (!res.ok) {
        setErroForm(data.error ?? 'Erro ao salvar')
        return
      }

      // Adiciona o novo cliente na lista sem recarregar tudo
      if (data.cliente) setClientes(prev => [data.cliente!, ...prev])
      setModalAberto(false)
      setForm(FORM_VAZIO)
    } catch {
      setErroForm('Falha na comunicação com o servidor')
    } finally {
      setSalvando(false)
    }
  }

  function fecharModal() {
    if (salvando) return
    setModalAberto(false)
    setForm(FORM_VAZIO)
    setErroForm(null)
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <TopBar
        title="Clientes"
        subtitle={
          carregando
            ? 'Carregando…'
            : `${clientes.filter(c => c.ativo).length} ativos de ${clientes.length} total`
        }
        actions={
          <Button size="sm" onClick={() => setModalAberto(true)}>
            <Plus size={14} />Novo Cliente
          </Button>
        }
      />

      <div className="p-8">
        {/* ── Lista + painel lateral ── */}
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {carregando ? (
              <div className="flex items-center justify-center py-16 text-white/40">
                <Loader2 size={20} className="animate-spin mr-2" />Carregando clientes…
              </div>
            ) : clientes.length === 0 ? (
              <Card>
                <div className="p-8 text-center text-white/40">
                  Nenhum cliente cadastrado ainda.
                </div>
              </Card>
            ) : (
              clientes.map(cliente => (
                <Card
                  key={cliente.id}
                  onClick={() => selecionarCliente(cliente)}
                  className={selecionado?.id === cliente.id ? 'border-[#009c3b]/40' : ''}
                >
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-11 h-11 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-base">
                        {cliente.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-semibold text-sm">{cliente.nome}</p>
                        <Badge variant={cliente.ativo ? 'success' : 'danger'}>
                          {cliente.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant={planoBadge[cliente.plano] ?? 'default'}>
                          {cliente.plano.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-white/40 text-xs">
                        <span className="font-mono">{cliente.cnpj}</span>
                        <span className="flex items-center gap-1"><Mail size={10} />{cliente.email}</span>
                        {cliente.telefone && (
                          <span className="flex items-center gap-1"><Phone size={10} />{cliente.telefone}</span>
                        )}
                      </div>
                      <p className="text-white/30 text-xs mt-1">
                        {cliente.empresas.length} empresa{cliente.empresas.length !== 1 ? 's' : ''}
                        {' · '}
                        Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Painel lateral */}
          {selecionado && (
            <div className="w-80 space-y-4">
              <Card>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#009c3b]/15 border border-[#009c3b]/25 rounded-xl flex items-center justify-center">
                      <span className="text-[#009c3b] font-bold text-lg">
                        {selecionado.nome.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{selecionado.nome}</p>
                      <p className="text-white/40 text-xs">{selecionado.cnpj}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">E-mail</span>
                      <span className="text-white text-xs">{selecionado.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Plano</span>
                      <Badge variant={planoBadge[selecionado.plano] ?? 'default'}>
                        {selecionado.plano}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Empresas</span>
                      <span className="text-white">{selecionado.empresas.length}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/8 pt-3 mb-4">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Filiais</p>
                    {selecionado.empresas.map(e => (
                      <div key={e.id} className="flex items-center gap-2 py-1.5">
                        <Building2 size={12} className="text-white/30" />
                        <span className="text-white/70 text-xs flex-1">{e.nome}</span>
                        {e.is_master && <Badge variant="default">Master</Badge>}
                      </div>
                    ))}
                  </div>

                  {/* ── Usuários ── */}
                  <div className="border-t border-white/8 pt-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={11} />Usuários PWA
                      </p>
                      <button
                        onClick={abrirModalUsuario}
                        className="text-[#009c3b] hover:text-[#00b548] transition-colors"
                        title="Adicionar usuário"
                      >
                        <UserPlus size={13} />
                      </button>
                    </div>

                    {carregandoUsers ? (
                      <div className="flex items-center gap-1.5 py-2 text-white/30 text-xs">
                        <Loader2 size={10} className="animate-spin" />Carregando…
                      </div>
                    ) : usuarios.length === 0 ? (
                      <p className="text-white/25 text-xs italic py-1">Nenhum usuário cadastrado</p>
                    ) : (
                      <div className="space-y-1">
                        {usuarios.map(u => (
                          <div key={u.id} className="py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-white/8 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white/60 text-[10px] font-bold">{u.nome.charAt(0)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white/80 text-xs truncate">{u.nome}</p>
                                <p className="text-white/30 text-[10px] truncate">{u.email}</p>
                              </div>
                              <Badge variant={u.role === 'dono' ? 'purple' : u.role === 'gerente' ? 'info' : 'default'}>
                                {u.role}
                              </Badge>
                              <button
                                onClick={() => desativarUsuario(u.id)}
                                className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                                title="Desativar usuário"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {/* Postos vinculados */}
                            {u.empresaIds && u.empresaIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 pl-8">
                                {u.empresaIds.map(eid => {
                                  const emp = selecionado?.empresas.find(e => e.id === eid)
                                  return emp ? (
                                    <span key={eid} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <Building2 size={8} />{emp.nome}
                                    </span>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => gerarToken(selecionado)}
                      loading={gerandoToken}
                    >
                      <Key size={13} />
                      Gerar Token do Agente
                    </Button>
                    <Button variant="secondary" size="sm" className="w-full">
                      <BarChart3 size={13} />
                      Ver Gráficos Associados
                    </Button>
                  </div>
                </div>
              </Card>

              {token && (
                <Card>
                  <div className="p-4">
                    <p className="text-[#009c3b] text-xs font-semibold mb-2 uppercase tracking-wider">
                      Token JWT do Agente
                    </p>
                    <div className="bg-black/40 rounded-lg p-3 mb-3">
                      <code className="text-green-400 text-[10px] break-all leading-relaxed font-mono">
                        {token}
                      </code>
                    </div>
                    <p className="text-white/30 text-xs">
                      Cole em <code className="text-white/50">config.json → jwt_token</code> no servidor do cliente.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Novo Usuário ── */}
      {modalUsuario && selecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => { if (!salvandoUser) { setModalUsuario(false); setErroUser(null) } }}
        >
          <div
            className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold text-base">Novo Usuário</h2>
                <p className="text-white/40 text-xs">{selecionado.nome}</p>
              </div>
              <button onClick={() => { setModalUsuario(false); setErroUser(null) }} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={salvarUsuario} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-white/60 text-xs mb-1 block">Nome completo *</label>
                <Input
                  placeholder="João da Silva"
                  value={formUser.nome}
                  onChange={e => setFormUser(f => ({ ...f, nome: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">E-mail *</label>
                <Input
                  type="email"
                  placeholder="joao@posto.com.br"
                  value={formUser.email}
                  onChange={e => setFormUser(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Telefone *</label>
                <Input
                  type="tel"
                  placeholder="(11) 9 9999-0000"
                  value={formUser.telefone}
                  onChange={e => setFormUser(f => ({ ...f, telefone: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Perfil *</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#009c3b]/50"
                    value={formUser.role}
                    onChange={e => setFormUser(f => ({ ...f, role: e.target.value as UserRole }))}
                    required
                  >
                    <option value="operador" className="bg-[#0f1117]">Operador</option>
                    <option value="gerente"  className="bg-[#0f1117]">Gerente</option>
                    <option value="dono"     className="bg-[#0f1117]">Proprietário</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">Senha inicial *</label>
                  <Input
                    type="password"
                    placeholder="mín. 6 caracteres"
                    value={formUser.senha}
                    onChange={e => setFormUser(f => ({ ...f, senha: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* ── Postos (empresas) ── */}
              {selecionado.empresas.length > 0 && (
                <div>
                  <label className="text-white/60 text-xs mb-2 block flex items-center gap-1.5">
                    <Building2 size={11} />
                    Postos com acesso *
                    {selecionado.empresas.length === 1 && (
                      <span className="text-white/30 text-[10px]">(único posto — selecionado automaticamente)</span>
                    )}
                  </label>
                  <div className="space-y-1.5">
                    {selecionado.empresas.map(emp => (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          formUser.empresa_ids.includes(emp.id)
                            ? 'border-[#009c3b]/40 bg-[#009c3b]/8 text-white'
                            : 'border-white/8 bg-white/3 text-white/50 hover:border-white/15'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[#009c3b]"
                          checked={formUser.empresa_ids.includes(emp.id)}
                          onChange={() => toggleEmpresa(emp.id)}
                        />
                        <Building2 size={13} className={formUser.empresa_ids.includes(emp.id) ? 'text-[#009c3b]' : 'text-white/30'} />
                        <span className="text-sm flex-1">{emp.nome}</span>
                        {emp.is_master && <Badge variant="default">Master</Badge>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {erroUser && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {erroUser}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" className="flex-1"
                  onClick={() => { setModalUsuario(false); setErroUser(null) }} disabled={salvandoUser}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={salvandoUser}>
                  <UserPlus size={13} />Criar Usuário
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Novo Cliente ── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={fecharModal}
        >
          <div
            className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="text-white font-semibold text-base">Novo Cliente</h2>
              <button onClick={fecharModal} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={salvarCliente} className="p-6 space-y-4">
              {/* Dados do cliente */}
              <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Dados do cliente</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-white/60 text-xs mb-1 block">Nome / Razão Social *</label>
                  <Input
                    placeholder="Posto Central Ltda"
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">CNPJ *</label>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={form.cnpj}
                    onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">Plano *</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#009c3b]/50"
                    value={form.plano}
                    onChange={e => setForm(f => ({ ...f, plano: e.target.value as Plano }))}
                    required
                  >
                    {PLANOS.map(p => (
                      <option key={p.value} value={p.value} className="bg-[#0f1117]">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">E-mail *</label>
                  <Input
                    type="email"
                    placeholder="contato@posto.com.br"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">Telefone</label>
                  <Input
                    placeholder="(11) 9 9999-0000"
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Empresa master */}
              <p className="text-white/50 text-xs uppercase tracking-wider font-medium pt-1">
                Empresa / Filial principal
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Nome da Empresa *</label>
                  <Input
                    placeholder="Posto Central"
                    value={form.empresa_nome}
                    onChange={e => setForm(f => ({ ...f, empresa_nome: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs mb-1 block">CNPJ da Filial</label>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={form.empresa_cnpj}
                    onChange={e => setForm(f => ({ ...f, empresa_cnpj: e.target.value }))}
                  />
                </div>
              </div>

              {/* Erro */}
              {erroForm && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {erroForm}
                </p>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={salvando}
                >
                  <Plus size={14} />
                  Cadastrar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
