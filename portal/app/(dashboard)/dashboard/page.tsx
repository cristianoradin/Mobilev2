'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import type { DateRange } from '@/components/ui/DateRangePicker'
import { Users, BarChart3, Activity, FileCheck, Wifi, WifiOff, Clock, Loader2 } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Kpis {
  clientesAtivos: number
  graficosTotal:  number
  agentesOnline:  number
  agentesTotal:   number
  licencasAtivas: number
}

interface Agente {
  id:              string
  status:          string
  ultimoHeartbeat: string | null
  versao:          string | null
  clienteNome:     string
  cnpj:            string
}

interface Atividade {
  acao:      string
  detalhe:   string
  createdAt: string
}

interface Stats {
  kpis:      Kpis
  agentes:   Agente[]
  atividade: Atividade[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function tempoRelativo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function corAtividade(acao: string): string {
  if (acao.includes('conectado') || acao.includes('cadastrado') || acao.includes('criado') || acao.includes('gerada'))
    return 'text-[#009c3b]'
  if (acao.includes('desconectado'))
    return 'text-red-400'
  if (acao.includes('Propaganda'))
    return 'text-amber-400'
  if (acao.includes('Gráfico') || acao.includes('Licença'))
    return 'text-blue-400'
  return 'text-white/60'
}

function defaultRange(): DateRange {
  const to   = new Date(); to.setHours(0,0,0,0)
  const from = new Date(to); from.setDate(from.getDate() - 29)
  return { from, to }
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [period,  setPeriod]  = useState<DateRange>(defaultRange)
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const fmtPeriod = () => {
    if (!period.from || !period.to) return ''
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    return `${fmt(period.from)} → ${fmt(period.to)}`
  }

  const kpis = stats ? [
    {
      label: 'Clientes Ativos',
      value: String(stats.kpis.clientesAtivos),
      delta: 'clientes em produção',
      icon:  Users,
      color: '#009c3b',
    },
    {
      label: 'Templates de Gráfico',
      value: String(stats.kpis.graficosTotal),
      delta: 'templates criados',
      icon:  BarChart3,
      color: '#3b82f6',
    },
    {
      label: 'Agentes Online',
      value: `${stats.kpis.agentesOnline}/${stats.kpis.agentesTotal}`,
      delta: stats.kpis.agentesTotal - stats.kpis.agentesOnline > 0
        ? `${stats.kpis.agentesTotal - stats.kpis.agentesOnline} offline`
        : 'todos online',
      icon:  Activity,
      color: '#f97316',
    },
    {
      label: 'Licenças Ativas',
      value: String(stats.kpis.licencasAtivas),
      delta: 'licenças vigentes',
      icon:  FileCheck,
      color: '#8b5cf6',
    },
  ] : []

  return (
    <div>
      <TopBar
        title="Visão Geral"
        subtitle={fmtPeriod() || 'Painel de controle do SGA Petro Cloud'}
        actions={
          <DateRangePicker
            value={period}
            onChange={setPeriod}
            placeholder="Selecionar período"
          />
        }
      />

      <div className="p-8 space-y-8">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-4 gap-5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardBody className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </CardBody>
              </Card>
            ))
          ) : error ? (
            <div className="col-span-4 text-white/40 text-sm text-center py-4">
              Erro ao carregar estatísticas
            </div>
          ) : kpis.map(({ label, value, delta, icon: Icon, color }) => (
            <Card key={label}>
              <CardBody className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '20' }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1">{label}</p>
                  <p className="text-white text-2xl font-bold">{value}</p>
                  <p className="text-white/40 text-xs mt-0.5">{delta}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">

          {/* ── Status dos Agentes ── */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold">Status dos Agentes</h2>
                  <Badge variant="default">Tempo real</Badge>
                </div>
              </CardHeader>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              ) : !stats || stats.agentes.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Wifi size={28} className="text-white/15 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">Nenhum agente instalado ainda</p>
                  <p className="text-white/20 text-xs mt-1">
                    Instale o agente na máquina do cliente usando o token gerado em Clientes
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {stats.agentes.map(agente => (
                    <div key={agente.id} className="flex items-center px-6 py-4 gap-4">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        agente.status === 'online'
                          ? 'bg-[#009c3b] shadow-sm shadow-[#009c3b]'
                          : 'bg-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{agente.clienteNome}</p>
                        <p className="text-white/40 text-xs font-mono">{agente.cnpj}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {agente.status === 'online'
                          ? <Wifi    size={14} className="text-[#009c3b]" />
                          : <WifiOff size={14} className="text-red-400"   />}
                        <div className="flex items-center gap-1 text-white/40 text-xs">
                          <Clock size={11} />
                          <span>{tempoRelativo(agente.ultimoHeartbeat)}</span>
                        </div>
                      </div>
                      <Badge variant={agente.status === 'online' ? 'success' : 'danger'}>
                        {agente.status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Atividade Recente ── */}
          <Card>
            <CardHeader>
              <h2 className="text-white font-semibold">Atividade Recente</h2>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-white/40" />
                </div>
              ) : !stats || stats.atividade.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-white/25 text-sm">Nenhuma atividade registrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.atividade.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${corAtividade(item.acao)}`}>{item.acao}</p>
                        <p className="text-white/40 text-xs truncate">{item.detalhe}</p>
                      </div>
                      <span className="text-white/25 text-xs flex-shrink-0">
                        {tempoRelativo(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

        </div>
      </div>
    </div>
  )
}
