'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { TopBar }             from '@/components/layout/TopBar'
import { Card, CardHeader }   from '@/components/ui/Card'
import { Badge }              from '@/components/ui/Badge'
import { Button }             from '@/components/ui/Button'
import {
  AlertTriangle, CheckCircle2, Clock, RefreshCw, Filter, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface Alerta {
  id: number; tipo: string; refId: string | null
  severidade: 'info' | 'warn' | 'critical'
  titulo: string; detalhe: string | null
  criadoEm: string; envios: number
  estado: 'aberto' | 'resolvido'
  resolvidoEm: string | null
  duracaoSeg: number
}

const TIPO_LABEL: Record<string, string> = {
  agente_offline:    'Agente offline',
  licenca_expirando: 'Licença expirando',
  error_rate:        'Taxa de erros',
  emqx_down:         'EMQX inacessível',
  db_down:           'Banco indisponível',
}

function fmtDuracao(seg: number): string {
  if (seg < 60)     return `${seg}s`
  if (seg < 3600)   return `${Math.floor(seg / 60)}min`
  if (seg < 86400)  return `${Math.floor(seg / 3600)}h ${Math.floor((seg % 3600) / 60)}m`
  return `${Math.floor(seg / 86400)}d ${Math.floor((seg % 86400) / 3600)}h`
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AlertasPage() {
  const [data,    setData]    = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [days,    setDays]    = useState(30)
  const [filtroSeveridade, setFiltroSeveridade] = useState<'todos' | 'critical' | 'warn' | 'info'>('todos')
  const [filtroEstado,     setFiltroEstado]     = useState<'todos' | 'aberto' | 'resolvido'>('todos')
  const [filtroTipo,       setFiltroTipo]       = useState<'todos' | string>('todos')

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/alertas?historico=true&days=${days}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ alertas: Alerta[] }>
      })
      .then(d => setData(d.alertas ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [days])

  useEffect(() => { load() }, [load])

  // Filtros aplicados client-side
  const filtered = useMemo(() => data.filter(a => {
    if (filtroSeveridade !== 'todos' && a.severidade !== filtroSeveridade) return false
    if (filtroEstado     !== 'todos' && a.estado     !== filtroEstado)     return false
    if (filtroTipo       !== 'todos' && a.tipo       !== filtroTipo)       return false
    return true
  }), [data, filtroSeveridade, filtroEstado, filtroTipo])

  const tiposDistintos = useMemo(() => Array.from(new Set(data.map(a => a.tipo))).sort(), [data])

  const totais = useMemo(() => ({
    total:     data.length,
    abertos:   data.filter(a => a.estado === 'aberto').length,
    critical:  data.filter(a => a.severidade === 'critical').length,
    resolvidos: data.filter(a => a.estado === 'resolvido').length,
  }), [data])

  return (
    <div className="min-h-screen">
      <TopBar
        title="Alertas"
        subtitle="Histórico de alertas detectados e resolvidos"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white/80 focus:outline-none focus:border-white/20"
            >
              <option value={1}>Últimas 24h</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── Cards de totais ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-white/40 text-xs">Total no período</div>
            <div className="text-2xl font-semibold text-white/90">{totais.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-white/40 text-xs">Abertos agora</div>
            <div className={cn('text-2xl font-semibold', totais.abertos > 0 ? 'text-amber-400' : 'text-emerald-400')}>
              {totais.abertos}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-white/40 text-xs">Críticos</div>
            <div className={cn('text-2xl font-semibold', totais.critical > 0 ? 'text-red-400' : 'text-white/40')}>
              {totais.critical}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-white/40 text-xs">Resolvidos</div>
            <div className="text-2xl font-semibold text-emerald-400">{totais.resolvidos}</div>
          </Card>
        </div>

        {/* ── Banner de erro ── */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={20} />
            <div className="flex-1 text-white/80 text-sm">Falha ao carregar histórico de alertas.</div>
            <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Tentar novamente
            </Button>
          </div>
        )}

        {/* ── Filtros ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-white/70">
              <Filter size={14} />
              Filtros
            </div>
          </CardHeader>
          <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-white/40 text-[10px] uppercase">Severidade</label>
              <select
                value={filtroSeveridade}
                onChange={e => setFiltroSeveridade(e.target.value as typeof filtroSeveridade)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-white/20"
              >
                <option value="todos">Todas</option>
                <option value="critical">Crítica</option>
                <option value="warn">Aviso</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="text-white/40 text-[10px] uppercase">Estado</label>
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-white/20"
              >
                <option value="todos">Todos</option>
                <option value="aberto">Abertos</option>
                <option value="resolvido">Resolvidos</option>
              </select>
            </div>
            <div>
              <label className="text-white/40 text-[10px] uppercase">Tipo</label>
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-white/20"
              >
                <option value="todos">Todos</option>
                {tiposDistintos.map(t => (
                  <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* ── Tabela ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <AlertTriangle size={14} />
                {filtered.length} alerta(s) — exibindo {filtered.length === data.length ? 'tudo' : `${filtered.length} de ${data.length}`}
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs">
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Sev</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Título</th>
                  <th className="px-4 py-2.5 text-left font-medium">Início</th>
                  <th className="px-4 py-2.5 text-left font-medium">Fim</th>
                  <th className="px-4 py-2.5 text-right font-medium">Duração</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pushes</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-white/30">
                    <Loader2 size={20} className="animate-spin inline mr-2" />
                    Carregando…
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && !error && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-white/30">
                    {data.length === 0
                      ? 'Sem alertas no período selecionado'
                      : 'Nenhum alerta bate com os filtros aplicados'}
                  </td></tr>
                )}
                {!loading && filtered.map(a => {
                  const sevColor =
                    a.severidade === 'critical' ? 'danger'  :
                    a.severidade === 'warn'     ? 'warning' : 'info'
                  return (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {a.estado === 'aberto' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <Badge variant="warning">Aberto</Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-400/80">
                            <CheckCircle2 size={13} />
                            <span className="text-xs">Resolvido</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={sevColor}>{a.severidade}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                      </td>
                      <td className="px-4 py-2.5 max-w-[250px]">
                        <div className="text-white/85 truncate">{a.titulo}</div>
                        {a.detalhe && <div className="text-white/40 text-xs truncate">{a.detalhe}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">{fmtData(a.criadoEm)}</td>
                      <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">{fmtData(a.resolvidoEm)}</td>
                      <td className="px-4 py-2.5 text-right text-white/60 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} className="text-white/30" />
                          {fmtDuracao(a.duracaoSeg)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-white/50 text-xs">{a.envios}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
