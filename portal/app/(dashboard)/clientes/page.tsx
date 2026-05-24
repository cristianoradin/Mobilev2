'use client'
import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { TopBar }  from '@/components/layout/TopBar'
import { Card }    from '@/components/ui/Card'
import { Badge }   from '@/components/ui/Badge'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { type Cliente, type Plano, type UserRole } from '@/lib/types'
import { SYSTEM_TEMPLATES } from '@/lib/templates'
import {
  Plus, Building2, Mail, Phone, ChevronRight,
  Key, BarChart3, X, Loader2, Users, Trash2, UserPlus,
  LayoutDashboard, LineChart, PieChart, Gauge, TrendingUp, TableProperties,
  Flame, Layers, MousePointerClick, PanelsTopLeft,
  Terminal, Copy, Check, Search, Wifi, WifiOff, Clock,
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
function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function AgenteStatusBadge({ status, heartbeat }: { status?: string | null; heartbeat?: string | null }) {
  if (!status) {
    return (
      <span className="flex items-center gap-1 text-white/25 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
        Sem agente
      </span>
    )
  }
  const isOnline = status === 'online'
  return (
    <span className={`flex items-center gap-1 text-xs ${isOnline ? 'text-[#009c3b]' : 'text-red-400'}`}>
      {isOnline
        ? <Wifi    size={11} className="flex-shrink-0" />
        : <WifiOff size={11} className="flex-shrink-0" />}
      {isOnline ? 'Online' : 'Offline'}
      {heartbeat && (
        <span className="flex items-center gap-0.5 text-white/30 ml-1">
          <Clock size={9} />
          {tempoRelativo(heartbeat)}
        </span>
      )}
    </span>
  )
}

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
  const [busca,       setBusca]       = useState('')
  const [carregando,  setCarregando]  = useState(true)

  const [selecionado,       setSelecionado]       = useState<Cliente | null>(null)
  const [gerandoInstalador, setGerandoInstalador] = useState(false)
  const [setupCommand,      setSetupCommand]      = useState<string | null>(null)
  const [copiado,           setCopiado]           = useState(false)

  const [modalAberto,  setModalAberto]  = useState(false)
  const [form,         setForm]         = useState<FormState>(FORM_VAZIO)
  const [salvando,     setSalvando]     = useState(false)
  const [erroForm,     setErroForm]     = useState<string | null>(null)

  // ── Modal Gráficos/Dashboards ────────────────────────────────────────────
  const [modalAcesso,    setModalAcesso]    = useState(false)
  const [abaAcesso,      setAbaAcesso]      = useState<'graficos' | 'dashboards'>('graficos')
  const [libTemplates,   setLibTemplates]   = useState<Record<string, { is_publico: boolean; cliente_ids: string[] }>>({})
  const [todosDashboards, setTodosDashboards] = useState<Array<{ id: string; nome: string; descricao?: string; cor?: string; isPublico?: boolean; clienteIds?: string[] }>>([])
  const [carregandoLib,  setCarregandoLib]  = useState(false)

  async function abrirModalAcesso() {
    setModalAcesso(true)
    setCarregandoLib(true)
    try {
      const [rT, rD] = await Promise.all([
        fetch('/api/graficos/liberacoes').then(r => r.json()),
        fetch('/api/dashboards').then(r => r.json()),
      ])
      setLibTemplates(rT.liberacoes ?? {})
      setTodosDashboards(rD.dashboards ?? [])
    } catch { /* silencioso */ }
    finally { setCarregandoLib(false) }
  }

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
    setSetupCommand(null)
    setCopiado(false)
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

  async function resetarSenha(userId: string) {
    if (!selecionado) return
    const novaSenha = prompt('Nova senha (mínimo 6 caracteres):')
    if (!novaSenha || novaSenha.length < 6) { alert('Senha muito curta ou cancelada.'); return }
    const res = await fetch(
      `/api/clientes/${selecionado.id}/usuarios?usuario_id=${userId}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: novaSenha }) }
    )
    if (res.ok) alert('Senha resetada com sucesso!')
    else alert('Erro ao resetar senha.')
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

  // ── gera token de instalação do agente ──────────────────────────────────
  async function gerarInstalador(cliente: Cliente) {
    setGerandoInstalador(true)
    setSetupCommand(null)
    setCopiado(false)
    try {
      const res  = await fetch('/api/agent/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cliente_id: cliente.id }),
      })
      const data = await res.json() as { setup_token?: string; error?: string }
      if (!res.ok) { setSetupCommand(`ERRO: ${data.error ?? 'Falha ao gerar'}`) }
      else         { setSetupCommand(data.setup_token ?? '') }
    } catch {
      setSetupCommand('ERRO: falha na comunicação com o servidor')
    } finally {
      setGerandoInstalador(false)
    }
  }

  function copiarComando() {
    if (!setupCommand) return
    navigator.clipboard.writeText(setupCommand).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
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
        {/* Busca */}
        <div className="relative mb-5 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou e-mail..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
          />
        </div>

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
              clientes
                .filter(c => !busca.trim() ||
                  c.nome.toLowerCase().includes(busca.toLowerCase()) ||
                  c.cnpj.includes(busca) ||
                  c.email.toLowerCase().includes(busca.toLowerCase())
                )
                .map(cliente => (
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
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-white/30 text-xs">
                          {cliente.empresas.length} empresa{cliente.empresas.length !== 1 ? 's' : ''}
                          {' · '}
                          Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <AgenteStatusBadge
                          status={cliente.agente_status}
                          heartbeat={cliente.agente_ultimo_heartbeat}
                        />
                      </div>
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
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-white/50">Agente</span>
                      <AgenteStatusBadge
                        status={selecionado.agente_status}
                        heartbeat={selecionado.agente_ultimo_heartbeat}
                      />
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
                                onClick={() => resetarSenha(u.id)}
                                className="text-white/20 hover:text-amber-400 transition-colors flex-shrink-0"
                                title="Resetar senha"
                              >
                                <Key size={11} />
                              </button>
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
                      variant="secondary" size="sm" className="w-full"
                      onClick={() => { setAbaAcesso('graficos'); abrirModalAcesso() }}
                    >
                      <BarChart3 size={13} />
                      Ver Gráficos Associados
                    </Button>
                    <Button
                      variant="secondary" size="sm" className="w-full"
                      onClick={() => { setAbaAcesso('dashboards'); abrirModalAcesso() }}
                    >
                      <LayoutDashboard size={13} />
                      Ver Dashboards Associados
                    </Button>
                  </div>
                </div>
              </Card>

              {/* ── Token de Instalação do Agente ── */}
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal size={13} className="text-[#009c3b]" />
                    <p className="text-[#009c3b] text-xs font-semibold uppercase tracking-wider">
                      Token de Instalação
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => gerarInstalador(selecionado)}
                    loading={gerandoInstalador}
                  >
                    <Key size={13} />
                    Gerar Token
                  </Button>

                  {setupCommand && !setupCommand.startsWith('ERRO') && (
                    <div className="mt-3">
                      {/* Token */}
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">Token</p>
                        <button
                          onClick={copiarComando}
                          className={`flex items-center gap-1 text-[10px] font-medium transition-colors px-2 py-0.5 rounded-md border ${
                            copiado
                              ? 'text-[#009c3b] border-[#009c3b]/30 bg-[#009c3b]/10'
                              : 'text-white/40 border-white/10 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {copiado ? <Check size={10} /> : <Copy size={10} />}
                          {copiado ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div
                        className="bg-black/60 border border-white/10 rounded-xl p-3 cursor-pointer hover:border-white/20 transition-colors"
                        onClick={copiarComando}
                        title="Clique para copiar"
                      >
                        <p className="text-green-400 text-[11px] font-mono break-all leading-relaxed select-all">
                          {setupCommand}
                        </p>
                      </div>
                      <p className="text-white/20 text-[10px] mt-2">
                        Use: <span className="text-white/35 font-mono">sga-agent.exe setup &lt;TOKEN&gt;</span>
                      </p>
                      <a
                        href="/agent/sga-agent.exe"
                        download
                        className="flex items-center gap-1.5 mt-2 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                      >
                        <Terminal size={9} />
                        Baixar sga-agent.exe
                      </a>
                    </div>
                  )}

                  {setupCommand?.startsWith('ERRO') && (
                    <p className="mt-2 text-red-400 text-[10px]">{setupCommand}</p>
                  )}
                </div>
              </Card>
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

      {/* ── Modal Gráficos / Dashboards ── */}
      {modalAcesso && selecionado && (() => {
        const ICON_MAP: Record<string, React.ElementType> = {
          line: LineChart, bar: BarChart3, pie: PieChart, gauge: Gauge,
          area: TrendingUp, report: TableProperties, kpi: Flame,
          heatmap: Layers, waterfall: BarChart3, button: MousePointerClick,
        }
        const clienteId = selecionado.id
        const templatesLib = SYSTEM_TEMPLATES.filter(t => {
          const l = libTemplates[t.id]
          return l && (l.is_publico || l.cliente_ids.includes(clienteId))
        })
        const dashboardsLib = todosDashboards.filter(d =>
          d.isPublico || (d.clienteIds ?? []).includes(clienteId)
        )

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setModalAcesso(false)}
          >
            <div
              className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
                <div>
                  <h2 className="text-white font-semibold text-base">Acessos Liberados</h2>
                  <p className="text-white/40 text-xs">{selecionado.nome}</p>
                </div>
                <button onClick={() => setModalAcesso(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/8 flex-shrink-0">
                {([['graficos', 'Gráficos', templatesLib.length],
                   ['dashboards', 'Dashboards', dashboardsLib.length]] as const).map(([key, label, count]) => (
                  <button
                    key={key}
                    onClick={() => setAbaAcesso(key)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      abaAcesso === key
                        ? 'text-white border-b-2 border-[#009c3b]'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {label}
                    <Badge variant={count > 0 ? 'success' : 'default'}>{count}</Badge>
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {carregandoLib ? (
                  <div className="flex items-center justify-center py-12 text-white/30 text-sm gap-2">
                    <Loader2 size={16} className="animate-spin" />Carregando…
                  </div>
                ) : abaAcesso === 'graficos' ? (
                  templatesLib.length === 0 ? (
                    <div className="text-center py-12 text-white/30 text-sm">
                      Nenhum gráfico liberado para este cliente.<br />
                      <span className="text-white/20 text-xs">Use a página de Gráficos para liberar.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templatesLib.map(t => {
                        const Icon = ICON_MAP[t.chart_type] ?? BarChart3
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                            <div className="w-8 h-8 rounded-lg bg-[#009c3b]/10 border border-[#009c3b]/20 flex items-center justify-center flex-shrink-0">
                              <Icon size={14} className="text-[#009c3b]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/90 text-sm font-medium truncate">{t.nome}</p>
                              <p className="text-white/30 text-xs truncate">{t.descricao}</p>
                            </div>
                            <Badge variant={libTemplates[t.id]?.is_publico ? 'success' : 'info'}>
                              {libTemplates[t.id]?.is_publico ? 'Público' : 'Liberado'}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  dashboardsLib.length === 0 ? (
                    <div className="text-center py-12 text-white/30 text-sm">
                      Nenhum dashboard liberado para este cliente.<br />
                      <span className="text-white/20 text-xs">Use a página de Dashboards para liberar.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dashboardsLib.map(d => (
                        <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
                            style={{ backgroundColor: (d.cor ?? '#009c3b') + '18', borderColor: (d.cor ?? '#009c3b') + '35' }}
                          >
                            <PanelsTopLeft size={14} style={{ color: d.cor ?? '#009c3b' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/90 text-sm font-medium truncate">{d.nome}</p>
                            <p className="text-white/30 text-xs truncate">{d.descricao}</p>
                          </div>
                          <Badge variant={d.isPublico ? 'success' : 'info'}>
                            {d.isPublico ? 'Público' : 'Liberado'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/8 flex-shrink-0">
                <Button variant="secondary" className="w-full" onClick={() => setModalAcesso(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

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
