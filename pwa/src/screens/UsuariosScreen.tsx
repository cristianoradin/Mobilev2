import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Building2, Loader2, X, Users } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { Card }    from '@/components/ui/Card'
import { Badge }   from '@/components/ui/Badge'

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://mobilev2.gruposgapetro.com.br:4443'

type UserRole = 'operador' | 'gerente'

interface UsuarioAPI {
  id:         string
  nome:       string
  email:      string
  telefone?:  string
  role:       string
  empresaIds: number[]
}

interface EmpresaAPI {
  id:       number
  nome:     string
  isMaster: boolean
}

const ROLE_LABEL: Record<string, string> = {
  operador: 'Operador',
  gerente:  'Gerente',
  dono:     'Proprietário',
}

const FORM_VAZIO = {
  nome:        '',
  email:       '',
  telefone:    '',
  senha:       '',
  role:        'operador' as UserRole,
  empresa_ids: [] as number[],
}

export function UsuariosScreen() {
  const { session }  = useAuth()
  const navigate     = useNavigate()

  const [usuarios,    setUsuarios]    = useState<UsuarioAPI[]>([])
  const [empresas,    setEmpresas]    = useState<EmpresaAPI[]>([])
  const [carregando,  setCarregando]  = useState(true)
  const [erro,        setErro]        = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [form,        setForm]        = useState(FORM_VAZIO)
  const [salvando,    setSalvando]    = useState(false)
  const [erroForm,    setErroForm]    = useState<string | null>(null)

  if (!session || session.role !== 'dono') {
    return (
      <div className="pt-4 text-center text-ink/40 text-sm">
        <Users size={40} className="mx-auto mb-3 opacity-30" />
        Apenas o proprietário pode gerenciar usuários.
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    carregarUsuarios()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregarUsuarios() {
    setCarregando(true)
    setErro(null)
    try {
      const res  = await fetch(`${PORTAL_URL}/api/mobile/usuarios`, {
        headers: { Authorization: `Bearer ${session!.jwt}` },
      })
      if (!res.ok) throw new Error('Falha ao carregar')
      const data = await res.json() as { usuarios: UsuarioAPI[]; empresas: EmpresaAPI[] }
      setUsuarios(data.usuarios ?? [])
      setEmpresas(data.empresas ?? [])
    } catch {
      setErro('Não foi possível carregar os usuários.')
    } finally {
      setCarregando(false)
    }
  }

  function abrirModal() {
    // Auto-seleciona se só há 1 posto
    const ids = empresas.length === 1 ? [empresas[0].id] : []
    setForm({ ...FORM_VAZIO, empresa_ids: ids })
    setErroForm(null)
    setModalAberto(true)
  }

  function toggleEmpresa(id: number) {
    setForm(f => ({
      ...f,
      empresa_ids: f.empresa_ids.includes(id)
        ? f.empresa_ids.filter(x => x !== id)
        : [...f.empresa_ids, id],
    }))
  }

  async function salvarUsuario(e: FormEvent) {
    e.preventDefault()
    if (form.empresa_ids.length === 0) { setErroForm('Selecione pelo menos um posto'); return }
    setErroForm(null)
    setSalvando(true)
    try {
      const res = await fetch(`${PORTAL_URL}/api/mobile/usuarios`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session!.jwt}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { usuario?: UsuarioAPI; error?: string }
      if (!res.ok) { setErroForm(data.error ?? 'Erro ao criar usuário'); return }
      if (data.usuario) setUsuarios(prev => [...prev, data.usuario!])
      setModalAberto(false)
    } catch {
      setErroForm('Falha na comunicação com o servidor')
    } finally {
      setSalvando(false)
    }
  }

  const empresaNome = (id: number) => empresas.find(e => e.id === id)?.nome ?? `Posto ${id}`

  return (
    <div className="pt-2 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/config')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-rim text-ink/50 hover:text-ink transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-ink font-bold text-lg">Usuários</h1>
          <p className="text-ink/40 text-xs">
            {carregando ? 'Carregando…' : `${usuarios.length} usuário(s) cadastrado(s)`}
          </p>
        </div>
        <button
          onClick={abrirModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
        >
          <UserPlus size={15} />
          Novo
        </button>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 text-ink/30 gap-2">
          <Loader2 size={20} className="animate-spin" />Carregando…
        </div>
      ) : erro ? (
        <Card className="p-5 text-center text-danger text-sm">{erro}</Card>
      ) : usuarios.length === 0 ? (
        <Card className="p-8 text-center">
          <Users size={32} className="mx-auto mb-3 text-ink/20" />
          <p className="text-ink/40 text-sm">Nenhum usuário cadastrado ainda.</p>
          <p className="text-ink/25 text-xs mt-1">Toque em "Novo" para adicionar.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {usuarios
            .filter(u => u.id !== session.id)  // não mostra o próprio dono
            .map(u => (
              <Card key={u.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold">{u.nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink font-semibold text-sm truncate">{u.nome}</p>
                    <p className="text-ink/40 text-xs truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'gerente' ? 'info' : u.role === 'dono' ? 'warning' : 'default'}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                </div>

                {/* Postos vinculados */}
                {u.empresaIds && u.empresaIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pl-13">
                    {u.empresaIds.map(eid => (
                      <span key={eid} className="flex items-center gap-1 text-[11px] bg-surface2 text-ink/50 px-2 py-0.5 rounded-lg">
                        <Building2 size={9} />{empresaNome(eid)}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
        </div>
      )}

      {/* ── Modal Novo Usuário ── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!salvando) setModalAberto(false) }}
        >
          <div
            className="w-full max-w-lg bg-bg border-t border-rim rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-ink/20 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-rim flex-shrink-0">
              <h2 className="text-ink font-bold text-base">Novo Usuário</h2>
              <button onClick={() => setModalAberto(false)} className="text-ink/40 hover:text-ink p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={salvarUsuario} className="p-5 space-y-4 overflow-y-auto">
              {/* Nome */}
              <div>
                <label className="text-ink/60 text-xs mb-1.5 block">Nome completo *</label>
                <input
                  className="w-full bg-surface border border-rim rounded-xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-primary/50"
                  placeholder="João da Silva"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  required
                />
              </div>

              {/* Email + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ink/60 text-xs mb-1.5 block">E-mail *</label>
                  <input
                    type="email"
                    className="w-full bg-surface border border-rim rounded-xl px-3 py-3 text-ink text-sm focus:outline-none focus:border-primary/50"
                    placeholder="joao@posto.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-ink/60 text-xs mb-1.5 block">Telefone *</label>
                  <input
                    type="tel"
                    className="w-full bg-surface border border-rim rounded-xl px-3 py-3 text-ink text-sm focus:outline-none focus:border-primary/50"
                    placeholder="(11) 99999-0000"
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Perfil + Senha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ink/60 text-xs mb-1.5 block">Perfil *</label>
                  <select
                    className="w-full bg-surface border border-rim rounded-xl px-3 py-3 text-ink text-sm focus:outline-none focus:border-primary/50"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                    required
                  >
                    <option value="operador">Operador</option>
                    <option value="gerente">Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="text-ink/60 text-xs mb-1.5 block">Senha *</label>
                  <input
                    type="password"
                    className="w-full bg-surface border border-rim rounded-xl px-3 py-3 text-ink text-sm focus:outline-none focus:border-primary/50"
                    placeholder="mín. 6 chars"
                    value={form.senha}
                    onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Postos */}
              {empresas.length > 0 && (
                <div>
                  <label className="text-ink/60 text-xs mb-2 block flex items-center gap-1.5">
                    <Building2 size={11} />
                    Postos com acesso *
                    {empresas.length === 1 && (
                      <span className="text-ink/30">(único posto — selecionado automaticamente)</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    {empresas.map(emp => (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          form.empresa_ids.includes(emp.id)
                            ? 'border-primary/40 bg-primary/8 text-ink'
                            : 'border-rim bg-surface text-ink/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary w-4 h-4"
                          checked={form.empresa_ids.includes(emp.id)}
                          onChange={() => toggleEmpresa(emp.id)}
                        />
                        <Building2 size={15} className={form.empresa_ids.includes(emp.id) ? 'text-primary' : 'text-ink/30'} />
                        <span className="flex-1 text-sm">{emp.nome}</span>
                        {emp.isMaster && (
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded">Principal</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {erroForm && (
                <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
                  {erroForm}
                </div>
              )}

              <div className="flex gap-3 pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="flex-1 py-3 rounded-xl border border-rim text-ink/60 text-sm font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {salvando
                    ? <Loader2 size={16} className="animate-spin" />
                    : <UserPlus size={16} />
                  }
                  {salvando ? 'Criando…' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
