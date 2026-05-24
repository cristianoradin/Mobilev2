'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast, Toaster } from '@/components/ui/Toast'
import {
  Plus, Shield, AlertTriangle, CheckCircle2, Clock,
  BarChart3, Users, Search, X,
} from 'lucide-react'
import type { LicencaItem } from '@/app/api/licencas/route'

// ── helpers ───────────────────────────────────────────────────────────────────
const planoBadge: Record<string, 'success' | 'info' | 'default'> = {
  basic: 'default', pro: 'info', enterprise: 'success',
}
const planoLabel: Record<string, string> = {
  basic: 'BASIC', pro: 'PRO', enterprise: 'ENTERPRISE',
}
const PLANOS = [
  { value: 'basic',      label: 'Basic'      },
  { value: 'pro',        label: 'Pro'        },
  { value: 'enterprise', label: 'Enterprise' },
]

function diasAteVencer(dateStr: string | null) {
  if (!dateStr) return -Infinity
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function ProgressBar({ value, max, color = '#009c3b' }: { value: number; max: number; color?: string }) {
  const pct     = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const warning = pct > 80
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: warning ? '#fbbf24' : color }} />
      </div>
      <span className="text-white/40 text-xs tabular-nums">{value}/{max}</span>
    </div>
  )
}

// ── Form padrão ───────────────────────────────────────────────────────────────
const FORM_VAZIO = {
  plano:          'basic',
  max_usuarios:   5,
  max_graficos:   10,
  data_expiracao: '',   // vazio = sem expiração
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function LicencasPage() {
  const { toasts, toast, dismiss } = useToast()

  const [licencas, setLicencas] = useState<LicencaItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [busca,    setBusca]    = useState('')

  // Modal criar/editar
  const [modal,     setModal]    = useState(false)
  const [editId,    setEditId]   = useState<string | null>(null)   // null = criar novo
  const [clienteId, setClienteId] = useState('')
  const [form,      setForm]     = useState(FORM_VAZIO)
  const [salvando,  setSalvando] = useState(false)

  // ── Carrega ──────────────────────────────────────────────────────────────
  function carregar() {
    setLoading(true)
    fetch('/api/licencas')
      .then(r => r.json())
      .then(d => setLicencas(d.licencas ?? []))
      .catch(() => setLicencas([]))
      .finally(() => setLoading(false))
  }
  useEffect(carregar, [])

  // ── Abre modal ────────────────────────────────────────────────────────────
  function abrirCriar(cid: string) {
    setEditId(null)
    setClienteId(cid)
    setForm(FORM_VAZIO)
    setModal(true)
  }

  function abrirEditar(lic: LicencaItem) {
    setEditId(lic.id!)
    setClienteId(lic.cliente_id)
    setForm({
      plano:          lic.plano,
      max_usuarios:   lic.max_usuarios,
      max_graficos:   lic.max_graficos,
      data_expiracao: lic.data_expiracao
        ? new Date(lic.data_expiracao).toISOString().slice(0, 10)
        : '',
    })
    setModal(true)
  }

  // ── Salva (criar ou editar) ───────────────────────────────────────────────
  async function salvar() {
    setSalvando(true)
    try {
      const payload = {
        ...form,
        max_usuarios:   Number(form.max_usuarios),
        max_graficos:   Number(form.max_graficos),
        data_expiracao: form.data_expiracao || null,
      }

      let res: Response
      if (editId) {
        res = await fetch(`/api/licencas/${editId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/licencas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_id: clienteId, ...payload }),
        })
      }

      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { toast(data.error ?? 'Erro ao salvar', 'error'); return }

      toast(editId ? 'Licença atualizada!' : 'Licença criada!', 'success')
      setModal(false)
      carregar()
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSalvando(false)
    }
  }

  // ── Suspender / Reativar ──────────────────────────────────────────────────
  async function toggleAtiva(lic: LicencaItem) {
    const acao = lic.ativa ? 'Suspender' : 'Reativar'
    if (!confirm(`${acao} a licença de ${lic.cliente_nome}?`)) return
    try {
      await fetch(`/api/licencas/${lic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: !lic.ativa }),
      })
      toast(`Licença ${lic.ativa ? 'suspensa' : 'reativada'}`, 'success')
      carregar()
    } catch {
      toast('Erro ao atualizar', 'error')
    }
  }

  // ── Filtro ────────────────────────────────────────────────────────────────
  const filtradas = busca.trim()
    ? licencas.filter(l =>
        l.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        l.plano.toLowerCase().includes(busca.toLowerCase())
      )
    : licencas

  const ativas      = licencas.filter(l => l.ativa).length
  const inativas    = licencas.filter(l => !l.ativa && l.id).length
  const expirando30 = licencas.filter(l => { const d = diasAteVencer(l.data_expiracao); return d > 0 && d <= 30 }).length

  const nomeCliente = licencas.find(l => l.cliente_id === clienteId)?.cliente_nome ?? ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <TopBar
        title="Licenças"
        subtitle={loading ? 'Carregando...' : `${ativas} ativa${ativas !== 1 ? 's' : ''} · ${inativas} inativa${inativas !== 1 ? 's' : ''}`}
      />

      <div className="p-8 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Licenças Ativas',    value: ativas,          icon: CheckCircle2,  color: '#009c3b' },
            { label: 'Clientes Totais',    value: licencas.length, icon: Shield,        color: '#3b82f6' },
            { label: 'Expiram em 30 dias', value: expirando30,     icon: AlertTriangle, color: '#fbbf24' },
            { label: 'Inativas',           value: inativas,        icon: Clock,         color: '#ef4444' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${kpi.color}18` }}>
                  <kpi.icon size={18} style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                  <p className="text-white/40 text-xs">{kpi.label}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {loading && <div className="text-center py-16 text-white/30 text-sm">Carregando licenças...</div>}

        {!loading && licencas.length === 0 && (
          <div className="text-center py-16 text-white/30 text-sm">Nenhum cliente cadastrado ainda.</div>
        )}

        {!loading && licencas.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou plano..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
            />
          </div>
        )}

        {/* Lista */}
        {!loading && (
          <div className="space-y-3">
            {filtradas.map(lic => {
              const dias       = diasAteVencer(lic.data_expiracao)
              const expirando  = dias > 0 && dias <= 30
              const semLicenca = !lic.id
              return (
                <Card key={lic.cliente_id}>
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        semLicenca  ? 'bg-white/5 border border-white/10'
                        : lic.ativa ? 'bg-[#009c3b]/10 border border-[#009c3b]/20'
                                    : 'bg-white/5 border border-white/10'
                      }`}>
                        <Shield size={18} className={lic.ativa && !semLicenca ? 'text-[#009c3b]' : 'text-white/30'} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-semibold text-sm">{lic.cliente_nome}</p>
                          <Badge variant={planoBadge[lic.plano] ?? 'default'}>
                            {planoLabel[lic.plano] ?? lic.plano.toUpperCase()}
                          </Badge>
                          {semLicenca
                            ? <Badge variant="warning">Sem Licença</Badge>
                            : <Badge variant={lic.ativa ? 'success' : 'danger'}>{lic.ativa ? 'Ativa' : 'Inativa'}</Badge>
                          }
                          {expirando && <Badge variant="warning">Expira em {dias}d</Badge>}
                        </div>

                        <p className="text-white/40 text-xs mb-3">
                          {semLicenca
                            ? 'Nenhuma licença associada a este cliente'
                            : lic.data_expiracao
                              ? `Vence em ${new Date(lic.data_expiracao).toLocaleDateString('pt-BR')}${dias > 0 ? ` · ${dias} dias restantes` : ' · Expirada'}`
                              : 'Sem data de expiração'
                          }
                        </p>

                        {!semLicenca && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Users size={11} className="text-white/30" />
                                <span className="text-white/40 text-xs">Usuários</span>
                              </div>
                              <ProgressBar value={lic.usuarios_ativos} max={lic.max_usuarios} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <BarChart3 size={11} className="text-white/30" />
                                <span className="text-white/40 text-xs">Gráficos (limite)</span>
                              </div>
                              <ProgressBar value={0} max={lic.max_graficos} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {semLicenca ? (
                          <Button variant="primary" size="sm" onClick={() => abrirCriar(lic.cliente_id)}>
                            <Plus size={13} />Criar Licença
                          </Button>
                        ) : (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => abrirEditar(lic)}>
                              Editar
                            </Button>
                            {lic.ativa
                              ? <Button variant="danger" size="sm" onClick={() => toggleAtiva(lic)}>Suspender</Button>
                              : <Button variant="primary" size="sm" onClick={() => toggleAtiva(lic)}>Reativar</Button>
                            }
                          </>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal Criar / Editar ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => { if (!salvando) setModal(false) }}>
          <div className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div>
                <h2 className="text-white font-semibold text-base">
                  {editId ? 'Editar Licença' : 'Nova Licença'}
                </h2>
                <p className="text-white/40 text-xs">{nomeCliente}</p>
              </div>
              <button onClick={() => setModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">

              {/* Plano */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Plano</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLANOS.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setForm(f => ({ ...f, plano: p.value }))}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        form.plano === p.value
                          ? 'bg-[#009c3b]/80 text-white'
                          : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limites */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Máx. Usuários</label>
                  <input type="number" min={1} max={999}
                    value={form.max_usuarios}
                    onChange={e => setForm(f => ({ ...f, max_usuarios: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#009c3b]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Máx. Gráficos</label>
                  <input type="number" min={1} max={9999}
                    value={form.max_graficos}
                    onChange={e => setForm(f => ({ ...f, max_graficos: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#009c3b]/50 transition-all"
                  />
                </div>
              </div>

              {/* Expiração */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">
                  Data de Expiração <span className="text-white/25">(vazio = sem expiração)</span>
                </label>
                <input type="date"
                  value={form.data_expiracao}
                  onChange={e => setForm(f => ({ ...f, data_expiracao: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#009c3b]/50 transition-all"
                />
                {/* Atalhos de prazo */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { label: '3 meses', months: 3 },
                    { label: '6 meses', months: 6 },
                    { label: '1 ano',   months: 12 },
                    { label: '2 anos',  months: 24 },
                  ].map(opt => {
                    const d = new Date(); d.setMonth(d.getMonth() + opt.months)
                    const iso = d.toISOString().slice(0, 10)
                    return (
                      <button key={opt.label} type="button"
                        onClick={() => setForm(f => ({ ...f, data_expiracao: iso }))}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/8 text-white/40 hover:text-white hover:bg-white/15 transition-all">
                        {opt.label}
                      </button>
                    )
                  })}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, data_expiracao: '' }))}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/8 text-white/40 hover:text-white hover:bg-white/15 transition-all">
                    Sem expiração
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-white/8">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setModal(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1 justify-center" onClick={salvar} loading={salvando}>
                {editId ? 'Salvar Alterações' : 'Criar Licença'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
