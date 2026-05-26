'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { TopBar }             from '@/components/layout/TopBar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge }              from '@/components/ui/Badge'
import { Button }             from '@/components/ui/Button'
import { AdminPushButton }    from '@/components/ui/AdminPushButton'
import {
  Activity, Database, Wifi, WifiOff, Cpu, Users, BarChart3,
  RefreshCw, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown,
  AlertTriangle, Bell, Shield, Zap, Key, Tag, ChevronDown, ChevronUp, Volume2, VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Health {
  status: string; db: string; db_ms: number
  mqtt: string; uptime: number; latency_ms: number
}
interface Summary {
  totalClientes: number; clientesAtivos: number
  totalUsuarios: number; usuariosAtivos: number
  totalAgentes: number; agentesOnline: number
  totalGraficos: number; totalPushSubs: number; totalAdmins: number
}
interface Agente {
  id: string; versao: string; statusReal: 'online' | 'offline'
  ultimoHb: string | null; segundosAtras: number | null
  clienteNome: string; clienteCnpj: string
}
interface AuditEvent {
  id: number; acao: string; recurso: string | null
  ipAddress: string | null; status: 'ok' | 'warn' | 'error'
  createdAt: string; adminEmail: string | null; adminNome: string | null
}
interface AuditByAction {
  acao: string; total: number; ok: number; warn: number; error: number
}
interface AuditHour {
  hora: string; total: number; ok: number; nok: number
}
interface AuditTotais {
  total: number; ok: number; warn: number; error: number
  loginsOk: number; loginsFailed: number
}
interface AuditTrend {
  total: number | null; error: number | null; loginsFailed: number | null
}
interface TopCliente {
  id: string; nome: string; cnpj: string; ativo: boolean
  eventos24h: number; ultimoEvento: string | null
  segDesdeUltimo: number | null; totalGraficos: number
}
interface LicencaExp {
  id: string; plano: string; dataExpiracao: string
  diasRestantes: number; clienteNome: string; clienteCnpj: string
}
interface VersaoAgente {
  versao: string; total: number; online: number
}
interface HbBuckets {
  b1_5min: number; b2_15min: number; b3_1h: number; b4_24h: number; b5_old: number
}
interface InfraEmqx {
  available: boolean
  connections?: number; liveConnections?: number
  sessions?: number; subscriptions?: number; topics?: number
  msgsInRate?: number; msgsOutRate?: number
  msgsInTotal?: number; msgsOutTotal?: number
}
interface InfraDbPool {
  total: number; ativas: number; idle: number; idleTxn: number; waiting: number; max: number
}
interface Infra {
  emqx: InfraEmqx
  dbPool: InfraDbPool
}
interface Data {
  health: Health; summary: Summary
  agentes: Agente[]
  audit: { recent: AuditEvent[]; byAction: AuditByAction[]; hourly: AuditHour[]; totais24h: AuditTotais; trend: AuditTrend }
  topClientes: TopCliente[]
  licencasExp: LicencaExp[]
  versoesAgente: VersaoAgente[]
  hbBuckets: HbBuckets
  infra: Infra
  generatedAt: string
}
interface Alerta {
  id: number; tipo: string; refId: string | null
  severidade: 'info' | 'warn' | 'critical'
  titulo: string; detalhe: string | null
  criadoEm: string; envios: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}
function timeAgo(sec: number | null) {
  if (sec === null) return '—'
  if (sec < 60)    return `${sec}s atrás`
  if (sec < 3600)  return `${Math.floor(sec / 60)}min atrás`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h atrás`
  return `${Math.floor(sec / 86400)}d atrás`
}
function cnpjFmt(c: string) {
  const d = c.replace(/\D/g, '')
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
const ACAO_LABEL: Record<string, string> = {
  'auth.login': 'Login OK', 'auth.login_failed': 'Login falhou',
  'auth.logout': 'Logout', 'token.generate': 'Token gerado',
  'grafico.create': 'Gráfico criado', 'grafico.update': 'Gráfico editado',
  'grafico.delete': 'Gráfico excluído', 'query.execute': 'Query executada',
  'query.blocked': 'Query bloqueada', 'cliente.create': 'Cliente criado',
  'licenca.create': 'Licença criada',
}

// ── Paleta escura ──────────────────────────────────────────────────────────────
const C = {
  ok:      '#10b981',  // emerald
  warn:    '#f59e0b',  // amber
  error:   '#ef4444',  // red
  blue:    '#3b82f6',
  purple:  '#a855f7',
  grid:    'rgba(255,255,255,0.06)',
  text:    'rgba(255,255,255,0.45)',
  text2:   'rgba(255,255,255,0.70)',
}
const echartsBase = {
  backgroundColor: 'transparent',
  textStyle: { color: C.text2, fontFamily: 'inherit' },
}

// ── Tendência (seta + delta %) ────────────────────────────────────────────────
function TrendArrow({ delta, invertColor = false }: { delta: number | null; invertColor?: boolean }) {
  if (delta === null) return null
  const Up = delta > 0
  // Por padrão verde = ↑ (mais é bom). Para erros, invertColor faz verde = ↓
  const good = invertColor ? !Up : Up
  const Icon = Up ? TrendingUp : TrendingDown
  const color = delta === 0
    ? 'text-white/30'
    : good ? 'text-emerald-400' : 'text-red-400'
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium ml-2', color)}>
      <Icon size={11} />
      {Math.abs(delta)}%
    </span>
  )
}

// ── Componente StatusCard ──────────────────────────────────────────────────────
function StatusCard({
  icon: Icon, label, value, sub, ok, loading, trend, trendInvert,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string; value: string; sub?: string
  ok: boolean | null; loading?: boolean
  trend?: number | null
  trendInvert?: boolean
}) {
  const color = loading ? 'text-white/30'
    : ok === null ? 'text-white/50'
    : ok ? 'text-emerald-400' : 'text-red-400'
  const bg = loading ? '' : ok === null ? '' : ok ? 'bg-emerald-500/5' : 'bg-red-500/5'
  return (
    <Card className={cn('flex flex-col gap-1 p-4', bg)}>
      <div className="flex items-center gap-2 text-white/50 text-xs">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <div className="flex items-center">
        <div className={cn('text-xl font-semibold', color)}>{loading ? '—' : value}</div>
        {!loading && trend !== undefined && <TrendArrow delta={trend ?? null} invertColor={trendInvert} />}
      </div>
      {sub && <div className="text-white/35 text-xs">{sub}</div>}
    </Card>
  )
}

// ── Som de notificação (beep curto via WebAudio) ──────────────────────────────
function playBeep() {
  try {
    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.start(); osc.stop(ctx.currentTime + 0.45)
    setTimeout(() => ctx.close(), 600)
  } catch { /* sem áudio, ignora */ }
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function ObservabilidadePage() {
  const [data,     setData]     = useState<Data | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [lastAt,   setLastAt]   = useState<string>('')
  const [refresh,  setRefresh]  = useState(0)
  const [alertas,  setAlertas]  = useState<Alerta[]>([])
  const [expanded, setExpanded] = useState(false)
  const [muted,    setMuted]    = useState(false)
  const knownIdsRef = useRef<Set<number>>(new Set())
  const firstLoadRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Carrega métricas e alertas em paralelo
      const [rObs, rAle] = await Promise.all([
        fetch('/api/observabilidade'),
        fetch('/api/alertas').catch(() => null),
      ])
      if (rObs.ok) {
        const d = await rObs.json() as Data
        setData(d)
        setLastAt(new Date().toLocaleTimeString('pt-BR'))
      }
      if (rAle?.ok) {
        const { alertas: novos } = await rAle.json() as { alertas: Alerta[] }
        // Detecta IDs novos comparando com os conhecidos
        const novosIds  = novos.map(a => a.id)
        const conhecidos = knownIdsRef.current
        const apareceuNovo = !firstLoadRef.current && novosIds.some(id => !conhecidos.has(id))
        knownIdsRef.current = new Set(novosIds)
        firstLoadRef.current = false
        setAlertas(novos)
        if (apareceuNovo && !muted) playBeep()
      }
    } finally {
      setLoading(false)
    }
  }, [muted])

  useEffect(() => { load() }, [load, refresh])

  // Auto-refresh a cada 180 segundos (3 min) — reduz carga DB/EMQX
  useEffect(() => {
    const id = setInterval(() => setRefresh(n => n + 1), 180_000)
    return () => clearInterval(id)
  }, [])

  const h = data?.health
  const s = data?.summary
  const a = data?.audit

  // ── Gráfico: Gauge latência DB ───────────────────────────────────────────────
  const gaugeOption = {
    ...echartsBase,
    series: [{
      type: 'gauge',
      radius: '85%',
      startAngle: 200, endAngle: -20,
      min: 0, max: 500,
      splitNumber: 5,
      axisLine: {
        lineStyle: {
          width: 14,
          color: [[0.2, C.ok], [0.5, '#84cc16'], [0.8, C.warn], [1, C.error]],
        },
      },
      pointer: { length: '60%', width: 4, itemStyle: { color: 'auto' } },
      axisTick:   { distance: -18, splitNumber: 5, lineStyle: { color: '#fff', width: 1 } },
      splitLine:  { distance: -24, length: 10, lineStyle: { color: '#fff', width: 2 } },
      axisLabel:  { color: C.text, fontSize: 10, distance: -40 },
      title:      { color: C.text2, fontSize: 12, offsetCenter: [0, '70%'] },
      detail: {
        valueAnimation: true, fontSize: 22, fontWeight: 600,
        color: 'auto', offsetCenter: [0, '40%'],
        formatter: '{value} ms',
      },
      data: [{ value: h?.db_ms ?? 0, name: 'Latência DB' }],
    }],
  }

  // ── Gráfico: Donut agentes ────────────────────────────────────────────────────
  const agOnline  = s?.agentesOnline ?? 0
  const agOffline = (s?.totalAgentes ?? 0) - agOnline
  const donutOption = {
    ...echartsBase,
    legend: { show: false },
    series: [{
      type: 'pie', radius: ['55%', '80%'],
      avoidLabelOverlap: false,
      label: {
        show: true, position: 'center',
        formatter: () => `${agOnline}\n/ ${s?.totalAgentes ?? 0}`,
        fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 24,
      },
      emphasis: { label: { show: true } },
      labelLine: { show: false },
      data: [
        { value: agOnline,  name: 'Online',  itemStyle: { color: C.ok } },
        { value: agOffline, name: 'Offline', itemStyle: { color: 'rgba(255,255,255,0.08)' } },
      ],
    }],
  }

  // ── Gráfico: Atividade por hora (últimas 24h) ─────────────────────────────────
  const hours  = a?.hourly.map(h => h.hora)    ?? []
  const hOk    = a?.hourly.map(h => h.ok)      ?? []
  const hNok   = a?.hourly.map(h => h.nok)     ?? []
  const barHourOption = {
    ...echartsBase,
    grid: { top: 20, bottom: 30, left: 40, right: 10 },
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a1a', borderColor: '#333' },
    legend: {
      data: ['OK', 'Alertas'], bottom: 0, textStyle: { color: C.text },
    },
    xAxis: { type: 'category', data: hours, axisLabel: { color: C.text, fontSize: 10 }, axisLine: { lineStyle: { color: C.grid } }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: C.text, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { name: 'OK', type: 'bar', stack: 'total', data: hOk, itemStyle: { color: C.ok }, barMaxWidth: 24 },
      { name: 'Alertas', type: 'bar', stack: 'total', data: hNok, itemStyle: { color: C.warn }, barMaxWidth: 24 },
    ],
  }

  // ── Gráfico: Top ações ────────────────────────────────────────────────────────
  const topAcoes  = [...(a?.byAction ?? [])].slice(0, 8).reverse()
  const barTopOption = {
    ...echartsBase,
    grid: { top: 10, bottom: 10, left: 130, right: 20 },
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a1a', borderColor: '#333' },
    xAxis: { type: 'value', axisLabel: { color: C.text, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: {
      type: 'category',
      data: topAcoes.map(x => ACAO_LABEL[x.acao] ?? x.acao),
      axisLabel: { color: C.text2, fontSize: 11 },
      axisLine: { lineStyle: { color: C.grid } },
    },
    series: [
      { name: 'OK',      type: 'bar', stack: 'a', data: topAcoes.map(x => x.ok),    itemStyle: { color: C.ok    }, barMaxWidth: 20 },
      { name: 'Avisos',  type: 'bar', stack: 'a', data: topAcoes.map(x => x.warn),  itemStyle: { color: C.warn  }, barMaxWidth: 20 },
      { name: 'Erros',   type: 'bar', stack: 'a', data: topAcoes.map(x => x.error), itemStyle: { color: C.error }, barMaxWidth: 20 },
    ],
  }

  // ── Gráfico: Pizza clientes ativos / inativos ─────────────────────────────────
  const pieClientesOption = {
    ...echartsBase,
    series: [{
      type: 'pie', radius: ['50%', '75%'],
      label: {
        show: true, position: 'center',
        formatter: () => `${s?.clientesAtivos ?? 0}`,
        fontSize: 20, fontWeight: 700, color: '#fff',
      },
      labelLine: { show: false },
      data: [
        { value: s?.clientesAtivos  ?? 0, name: 'Ativos',   itemStyle: { color: C.blue }   },
        { value: (s?.totalClientes ?? 0) - (s?.clientesAtivos ?? 0), name: 'Inativos', itemStyle: { color: 'rgba(255,255,255,0.08)' } },
      ],
    }],
  }

  // ── Gráfico: Logins 24h ───────────────────────────────────────────────────────
  const pieLoginOption = {
    ...echartsBase,
    series: [{
      type: 'pie', radius: ['50%', '75%'],
      label: {
        show: true, position: 'center',
        formatter: () => `${a?.totais24h.loginsOk ?? 0}`,
        fontSize: 20, fontWeight: 700, color: '#fff',
      },
      labelLine: { show: false },
      data: [
        { value: a?.totais24h.loginsOk     ?? 0, name: 'Sucesso', itemStyle: { color: C.ok    } },
        { value: a?.totais24h.loginsFailed ?? 0, name: 'Falhas',  itemStyle: { color: C.error } },
      ],
    }],
  }

  // ── Gráfico: Heartbeat buckets (barras horizontais) ──────────────────────────
  const hb = data?.hbBuckets
  const hbCats = ['< 5 min', '5–15 min', '15–60 min', '1–24 h', '> 24 h / nunca']
  const hbVals = [hb?.b1_5min ?? 0, hb?.b2_15min ?? 0, hb?.b3_1h ?? 0, hb?.b4_24h ?? 0, hb?.b5_old ?? 0]
  const hbColors = [C.ok, '#84cc16', C.warn, '#f97316', C.error]
  const hbOption = {
    ...echartsBase,
    grid: { top: 10, bottom: 10, left: 110, right: 30 },
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a1a', borderColor: '#333' },
    xAxis: { type: 'value', axisLabel: { color: C.text, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: {
      type: 'category', data: hbCats,
      axisLabel: { color: C.text2, fontSize: 11 },
      axisLine: { lineStyle: { color: C.grid } },
    },
    series: [{
      type: 'bar',
      data: hbVals.map((v, i) => ({ value: v, itemStyle: { color: hbColors[i] } })),
      barMaxWidth: 18,
      label: { show: true, position: 'right', color: C.text2, fontSize: 11 },
    }],
  }

  // ── Gráfico: Versões de agente (pie) ─────────────────────────────────────────
  const versoes = data?.versoesAgente ?? []
  const versaoColors = [C.ok, C.blue, C.purple, C.warn, C.error, '#84cc16', '#f97316']
  const versoesOption = {
    ...echartsBase,
    tooltip: { trigger: 'item', backgroundColor: '#1a1a1a', borderColor: '#333',
               formatter: (p: { name: string; value: number; percent: number }) =>
                 `${p.name}<br/>${p.value} agente(s) — ${p.percent}%` },
    series: [{
      type: 'pie', radius: ['45%', '75%'],
      label: {
        show: true, position: 'center',
        formatter: () => `${versoes.length}\nversão(ões)`,
        fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 18,
      },
      labelLine: { show: false },
      data: versoes.map((v, i) => ({
        value: v.total,
        name:  v.versao,
        itemStyle: { color: versaoColors[i % versaoColors.length] },
      })),
    }],
  }

  const systemOk = h?.status === 'ok'
  const dbOk     = h?.db === 'ok'
  const mqttOk   = h?.mqtt === 'ok'

  return (
    <div className="min-h-screen">
      <TopBar
        title="Observabilidade"
        subtitle="Monitoramento em tempo real do sistema SGA Petro"
        actions={
          <div className="flex items-center gap-3">
            <AdminPushButton />
            {lastAt && <span className="text-white/30 text-xs">Atualizado às {lastAt}</span>}
            <Button
              size="sm" variant="secondary"
              onClick={() => setRefresh(n => n + 1)}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── Banner de alertas ativos ─────────────────────────────────────── */}
        {alertas.length > 0 && (() => {
          const crit  = alertas.filter(a => a.severidade === 'critical').length
          const warns = alertas.filter(a => a.severidade === 'warn').length
          const hasCrit = crit > 0
          const palette = hasCrit
            ? { bg: 'bg-red-500/10',   border: 'border-red-500/30',   text: 'text-red-300',    icon: 'text-red-400'    }
            : { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-200',  icon: 'text-amber-400'  }
          return (
            <div className={cn('rounded-lg border', palette.bg, palette.border)}>
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className={palette.icon} size={20} />
                  <div className="text-left">
                    <div className={cn('font-semibold', palette.text)}>
                      {alertas.length} alerta{alertas.length === 1 ? '' : 's'} ativo{alertas.length === 1 ? '' : 's'}
                    </div>
                    <div className="text-white/50 text-xs">
                      {crit > 0  && <span className="text-red-400">{crit} crítico{crit === 1 ? '' : 's'}</span>}
                      {crit > 0 && warns > 0 && <span> · </span>}
                      {warns > 0 && <span className="text-amber-400">{warns} aviso{warns === 1 ? '' : 's'}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted(m => !m) }}
                    className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white/70"
                    title={muted ? 'Som desativado — clique para ativar' : 'Som ativo — clique para silenciar'}
                  >
                    {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  {expanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-3 space-y-1.5 border-t border-white/5 pt-3">
                  {alertas.map(a => {
                    const c = a.severidade === 'critical' ? 'text-red-400'
                            : a.severidade === 'warn'     ? 'text-amber-400'
                            : 'text-blue-400'
                    const dt = new Date(a.criadoEm)
                    const elapsed = Math.floor((Date.now() - dt.getTime()) / 1000)
                    return (
                      <div key={a.id} className="flex items-start gap-3 text-sm py-1">
                        <span className={cn('mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                          a.severidade === 'critical' ? 'bg-red-400' :
                          a.severidade === 'warn'     ? 'bg-amber-400' : 'bg-blue-400'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white/90 truncate">
                            <span className={cn('text-[10px] font-mono uppercase mr-2', c)}>{a.severidade}</span>
                            {a.titulo}
                          </div>
                          {a.detalhe && <div className="text-white/50 text-xs">{a.detalhe}</div>}
                        </div>
                        <span className="text-white/30 text-xs whitespace-nowrap">{timeAgo(elapsed)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Status Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatusCard
            icon={Activity} label="Sistema" loading={loading}
            value={systemOk ? 'Operacional' : 'Degradado'}
            sub={`Uptime: ${fmt(h?.uptime ?? 0)}`}
            ok={systemOk}
          />
          <StatusCard
            icon={Database} label="Banco de Dados" loading={loading}
            value={dbOk ? 'Online' : 'Erro'}
            sub={dbOk ? `${h?.db_ms}ms resposta` : 'Sem conexão'}
            ok={dbOk}
          />
          <StatusCard
            icon={mqttOk ? Wifi : WifiOff} label="EMQX / MQTT" loading={loading}
            value={mqttOk ? 'Online' : 'Inativo'}
            sub={mqttOk ? 'Broker acessível' : 'Sem resposta'}
            ok={mqttOk}
          />
          <StatusCard
            icon={Cpu} label="Agentes" loading={loading}
            value={`${s?.agentesOnline ?? 0} / ${s?.totalAgentes ?? 0}`}
            sub={s?.agentesOnline ? 'conectados agora' : 'nenhum online'}
            ok={(s?.agentesOnline ?? 0) > 0}
          />
          <StatusCard
            icon={Zap} label="Latência API" loading={loading}
            value={`${h?.latency_ms ?? 0} ms`}
            sub="tempo total health"
            ok={(h?.latency_ms ?? 999) < 500}
          />
          <StatusCard
            icon={TrendingUp} label="Eventos 24h" loading={loading}
            value={String(a?.totais24h.total ?? 0)}
            sub={`${a?.totais24h.warn ?? 0} alertas / ${a?.totais24h.error ?? 0} erros`}
            ok={(a?.totais24h.error ?? 0) === 0}
            trend={a?.trend.total}
          />
        </div>

        {/* ── Row 2: Gauge + Donuts ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Gauge latência DB */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Database size={14} />
                Latência do Banco
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-center py-2">
              {!loading && (
                <ReactECharts option={gaugeOption} style={{ height: 200, width: '100%' }} />
              )}
              {loading && <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>}
            </CardBody>
          </Card>

          {/* Donut agentes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Cpu size={14} />
                Agentes Online
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-center py-2">
              {!loading && (
                <ReactECharts option={donutOption} style={{ height: 200, width: '100%' }} />
              )}
              {loading && <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>}
            </CardBody>
          </Card>

          {/* Donut clientes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Users size={14} />
                Clientes Ativos
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-center py-2">
              {!loading && (
                <ReactECharts option={pieClientesOption} style={{ height: 200, width: '100%' }} />
              )}
              {loading && <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>}
              {!loading && (
                <div className="text-center text-white/40 text-xs -mt-2">
                  de {s?.totalClientes ?? 0} cadastrados
                </div>
              )}
            </CardBody>
          </Card>

          {/* Donut logins */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Shield size={14} />
                Logins (24h)
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-center py-2">
              {!loading && (
                <ReactECharts option={pieLoginOption} style={{ height: 200, width: '100%' }} />
              )}
              {loading && <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>}
              {!loading && (
                <div className="text-center text-white/40 text-xs -mt-2">
                  {a?.totais24h.loginsFailed ?? 0} falhas detectadas
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Row 3: Atividade por hora + Top ações ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Bar chart hora — ocupa 2 colunas */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <BarChart3 size={14} />
                Atividade por Hora — últimas 24h
              </div>
            </CardHeader>
            <CardBody>
              {!loading && a?.hourly.length ? (
                <ReactECharts option={barHourOption} style={{ height: 200 }} />
              ) : loading ? (
                <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Sem eventos nas últimas 24h</div>
              )}
            </CardBody>
          </Card>

          {/* Top ações */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <TrendingUp size={14} />
                Top Ações (24h)
              </div>
            </CardHeader>
            <CardBody>
              {!loading && a?.byAction.length ? (
                <ReactECharts option={barTopOption} style={{ height: 200 }} />
              ) : loading ? (
                <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-white/20 text-sm">Sem dados</div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Row 4: Resumo de números ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Usuários Ativos',    value: s?.usuariosAtivos ?? 0, total: s?.totalUsuarios ?? 0,   icon: Users,    color: 'text-blue-400' },
            { label: 'Gráficos',           value: s?.totalGraficos  ?? 0, total: null,                    icon: BarChart2, color: 'text-purple-400' },
            { label: 'Push Subscriptions', value: s?.totalPushSubs  ?? 0, total: null,                    icon: Bell,     color: 'text-amber-400' },
            { label: 'Admins do Portal',   value: s?.totalAdmins    ?? 0, total: null,                    icon: Shield,   color: 'text-emerald-400' },
            { label: 'Eventos Audit 24h',  value: a?.totais24h.ok   ?? 0, total: a?.totais24h.total ?? 0, icon: Activity, color: 'text-emerald-400' },
          ].map(({ label, value, total, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                <Icon size={12} />
                {label}
              </div>
              <div className={cn('text-2xl font-bold', loading ? 'text-white/20' : color)}>
                {loading ? '—' : value}
              </div>
              {total !== null && !loading && (
                <div className="text-white/30 text-xs mt-0.5">de {total} total</div>
              )}
            </Card>
          ))}
        </div>

        {/* ── Row 4.5: Heartbeat distribuição + Versões em campo ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Heartbeat buckets — 2 colunas */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Clock size={14} />
                Heartbeat — Tempo desde o último sinal
              </div>
            </CardHeader>
            <CardBody>
              {!loading && (data?.agentes.length ?? 0) > 0 ? (
                <ReactECharts option={hbOption} style={{ height: 220 }} />
              ) : loading ? (
                <div className="h-[220px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-white/20 text-sm">Sem agentes cadastrados</div>
              )}
            </CardBody>
          </Card>

          {/* Versões */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Tag size={14} />
                Versões em Campo
              </div>
            </CardHeader>
            <CardBody>
              {!loading && versoes.length > 0 ? (
                <>
                  <ReactECharts option={versoesOption} style={{ height: 160 }} />
                  <div className="space-y-1 mt-2">
                    {versoes.map((v, i) => (
                      <div key={v.versao} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: versaoColors[i % versaoColors.length] }}
                          />
                          <span className="text-white/70 font-mono">{v.versao}</span>
                        </div>
                        <span className="text-white/40">
                          {v.online}/{v.total} online
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : loading ? (
                <div className="h-[220px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-white/20 text-sm">Sem agentes cadastrados</div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Row 4.6: Top Clientes + Licenças expirando ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top Clientes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Users size={14} />
                  Clientes mais ativos (24h)
                </div>
                <span className="text-white/30 text-xs">top 15</span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-white/40 text-xs">
                    <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2.5 text-right font-medium">Eventos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Gráficos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Carregando…</td></tr>
                  )}
                  {!loading && (data?.topClientes.length ?? 0) === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sem clientes cadastrados</td></tr>
                  )}
                  {!loading && data?.topClientes.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-2 max-w-[180px]">
                        <div className="text-white/80 truncate">{c.nome}</div>
                        <div className="text-white/30 text-[10px] font-mono">{cnpjFmt(c.cnpj)}</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {c.eventos24h > 0 ? (
                          <span className="text-white/80 font-medium">{c.eventos24h}</span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-white/50 text-xs">{c.totalGraficos}</td>
                      <td className="px-4 py-2 text-right text-white/40 text-xs whitespace-nowrap">
                        {timeAgo(c.segDesdeUltimo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Licenças expirando */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Key size={14} />
                  Licenças expirando — 90 dias
                </div>
                <span className="text-white/30 text-xs">{data?.licencasExp.length ?? 0} licença(s)</span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-white/40 text-xs">
                    <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                    <th className="px-4 py-2.5 text-right font-medium">Expira em</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-white/20 text-xs">Carregando…</td></tr>
                  )}
                  {!loading && (data?.licencasExp.length ?? 0) === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-emerald-400/60 text-xs">
                      Nenhuma licença expira nos próximos 90 dias
                    </td></tr>
                  )}
                  {!loading && data?.licencasExp.map(l => {
                    const variant: 'success' | 'warning' | 'danger' =
                      l.diasRestantes <= 7  ? 'danger'  :
                      l.diasRestantes <= 30 ? 'warning' : 'success'
                    const rowBg =
                      l.diasRestantes <= 7  ? 'bg-red-500/5'    :
                      l.diasRestantes <= 30 ? 'bg-amber-500/5'  : ''
                    return (
                      <tr key={l.id} className={cn('border-b border-white/5 hover:bg-white/2', rowBg)}>
                        <td className="px-4 py-2 max-w-[180px]">
                          <div className="text-white/80 truncate">{l.clienteNome}</div>
                          <div className="text-white/30 text-[10px] font-mono">{cnpjFmt(l.clienteCnpj)}</div>
                        </td>
                        <td className="px-4 py-2 text-white/60 text-xs uppercase">{l.plano}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <Badge variant={variant}>
                            {l.diasRestantes <= 0
                              ? 'Hoje'
                              : `${l.diasRestantes}d`}
                          </Badge>
                          <div className="text-white/30 text-[10px] mt-0.5">
                            {new Date(l.dataExpiracao).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ── Row 4.7: Infra (MQTT broker + DB pool) ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* MQTT Broker (EMQX) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Wifi size={14} />
                  MQTT Broker (EMQX)
                </div>
                {data?.infra.emqx.available && (
                  <span className="text-emerald-400/70 text-xs">conectado</span>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="h-[140px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : !data?.infra.emqx.available ? (
                <div className="h-[140px] flex flex-col items-center justify-center text-white/30 text-xs gap-1">
                  <WifiOff size={20} className="text-red-400/60" />
                  API do EMQX inacessível
                  <span className="text-white/20">(check EMQX_API_KEY)</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-white/40 text-[10px] uppercase">Conexões</div>
                    <div className="text-xl font-semibold text-white/90">{data.infra.emqx.connections ?? 0}</div>
                    <div className="text-white/30 text-[10px]">{data.infra.emqx.liveConnections ?? 0} vivas</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] uppercase">Sessões</div>
                    <div className="text-xl font-semibold text-white/90">{data.infra.emqx.sessions ?? 0}</div>
                    <div className="text-white/30 text-[10px]">persistentes</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] uppercase">Tópicos</div>
                    <div className="text-xl font-semibold text-white/90">{data.infra.emqx.topics ?? 0}</div>
                    <div className="text-white/30 text-[10px]">{data.infra.emqx.subscriptions ?? 0} subs</div>
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                    <div>
                      <div className="text-white/40 text-[10px] uppercase">Entrada (msg/s)</div>
                      <div className="text-lg font-semibold text-blue-400">
                        {(data.infra.emqx.msgsInRate ?? 0).toFixed(1)}
                      </div>
                      <div className="text-white/30 text-[10px]">
                        total: {(data.infra.emqx.msgsInTotal ?? 0).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40 text-[10px] uppercase">Saída (msg/s)</div>
                      <div className="text-lg font-semibold text-purple-400">
                        {(data.infra.emqx.msgsOutRate ?? 0).toFixed(1)}
                      </div>
                      <div className="text-white/30 text-[10px]">
                        total: {(data.infra.emqx.msgsOutTotal ?? 0).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* DB Pool */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Database size={14} />
                  Pool de Conexões PostgreSQL
                </div>
                <span className="text-white/40 text-xs">
                  {data?.infra.dbPool.total ?? 0} / {data?.infra.dbPool.max ?? 0} max
                </span>
              </div>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="h-[140px] flex items-center justify-center text-white/20 text-sm">Carregando…</div>
              ) : (() => {
                const p = data!.infra.dbPool
                const util = p.max > 0 ? Math.round((p.total / p.max) * 100) : 0
                const utilColor = util >= 80 ? 'bg-red-400' : util >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <div className="text-xl font-semibold text-emerald-400">{p.ativas}</div>
                        <div className="text-white/40 text-[10px] uppercase">Ativas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-blue-400">{p.idle}</div>
                        <div className="text-white/40 text-[10px] uppercase">Idle</div>
                      </div>
                      <div className="text-center">
                        <div className={cn('text-xl font-semibold', p.idleTxn > 0 ? 'text-amber-400' : 'text-white/30')}>{p.idleTxn}</div>
                        <div className="text-white/40 text-[10px] uppercase">Idle&nbsp;txn</div>
                      </div>
                      <div className="text-center">
                        <div className={cn('text-xl font-semibold', p.waiting > 0 ? 'text-red-400' : 'text-white/30')}>{p.waiting}</div>
                        <div className="text-white/40 text-[10px] uppercase">Esperando</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-white/50">Utilização</span>
                        <span className={cn(
                          util >= 80 ? 'text-red-400' : util >= 60 ? 'text-amber-400' : 'text-white/60'
                        )}>{util}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                        <div className={cn('h-full transition-all', utilColor)} style={{ width: `${Math.min(util, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardBody>
          </Card>
        </div>

        {/* ── Row 5: Tabela de agentes ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Cpu size={14} />
                Status dos Agentes
              </div>
              <span className="text-white/30 text-xs">{data?.agentes.length ?? 0} agente(s)</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs">
                  <th className="px-6 py-3 text-left font-medium">Cliente</th>
                  <th className="px-6 py-3 text-left font-medium">CNPJ</th>
                  <th className="px-6 py-3 text-left font-medium">Versão</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Último Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-white/20">Carregando…</td></tr>
                )}
                {!loading && data?.agentes.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-white/20">Nenhum agente cadastrado</td></tr>
                )}
                {!loading && data?.agentes.map(ag => (
                  <tr key={ag.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-6 py-3 text-white/80 font-medium max-w-[200px] truncate">{ag.clienteNome}</td>
                    <td className="px-6 py-3 text-white/50 font-mono text-xs">{cnpjFmt(ag.clienteCnpj)}</td>
                    <td className="px-6 py-3">
                      <Badge variant="info">{ag.versao ?? '—'}</Badge>
                    </td>
                    <td className="px-6 py-3">
                      {ag.statusReal === 'online' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <Badge variant="success">Online</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
                          <Badge variant="danger">Offline</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-white/40 text-xs">
                      {ag.segundosAtras !== null ? timeAgo(ag.segundosAtras) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Row 6: Audit log recente ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                <Activity size={14} />
                Eventos Recentes
              </div>
              <span className="text-white/30 text-xs">últimos 30 registros</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs">
                  <th className="px-6 py-3 text-left font-medium">Quando</th>
                  <th className="px-6 py-3 text-left font-medium">Ação</th>
                  <th className="px-6 py-3 text-left font-medium">Recurso</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Admin / IP</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-white/20">Carregando…</td></tr>
                )}
                {!loading && data?.audit.recent.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-white/20">Sem eventos registrados</td></tr>
                )}
                {!loading && data?.audit.recent.map(ev => {
                  const dt = new Date(ev.createdAt)
                  const elapsed = Math.floor((Date.now() - dt.getTime()) / 1000)
                  return (
                    <tr key={ev.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-6 py-2.5 text-white/40 text-xs whitespace-nowrap">
                        {timeAgo(elapsed)}
                        <div className="text-white/20">{dt.toLocaleTimeString('pt-BR')}</div>
                      </td>
                      <td className="px-6 py-2.5">
                        <span className="text-white/70 text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
                          {ACAO_LABEL[ev.acao] ?? ev.acao}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-white/50 text-xs max-w-[180px] truncate">
                        {ev.recurso ?? '—'}
                      </td>
                      <td className="px-6 py-2.5">
                        <Badge variant={ev.status === 'ok' ? 'success' : ev.status === 'warn' ? 'warning' : 'danger'}>
                          {ev.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-2.5 text-white/40 text-xs">
                        <div>{ev.adminEmail ?? '—'}</div>
                        <div className="text-white/20">{ev.ipAddress ?? ''}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-white/20 text-xs pb-4">
          Auto-refresh a cada 3min · Última atualização: {lastAt || '—'}
          {data?.generatedAt && (
            <> · Dados gerados em {new Date(data.generatedAt).toLocaleTimeString('pt-BR')}</>
          )}
        </div>
      </div>
    </div>
  )
}

// Ícone extra não disponível no conjunto inicial
function BarChart2({ size, className }: { size?: number; className?: string }) {
  return <BarChart3 size={size} className={className} />
}
