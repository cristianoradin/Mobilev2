'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import type { DateRange } from '@/components/ui/DateRangePicker'
import { Users, BarChart3, Activity, TrendingUp, Wifi, WifiOff, Clock } from 'lucide-react'

const kpis = [
  { label: 'Clientes Ativos',    value: '12',   delta: '+2 este mês',    icon: Users,      color: '#009c3b' },
  { label: 'Templates Criados',  value: '47',   delta: '+8 esta semana', icon: BarChart3,  color: '#3b82f6' },
  { label: 'Agentes Online',     value: '9/12', delta: '3 offline',      icon: Activity,   color: '#f97316' },
  { label: 'Queries / Hora',     value: '1.4k', delta: '+12% vs ontem',  icon: TrendingUp, color: '#8b5cf6' },
]

const agentesStatus = [
  { cliente: 'Posto Central Ltda',    cnpj: '12.345.678/0001-99', status: 'online',  ultimo_ping: '2s'   },
  { cliente: 'Rede Petro Sul S.A.',   cnpj: '98.765.432/0001-11', status: 'online',  ultimo_ping: '5s'   },
  { cliente: 'Auto Posto Bela Vista', cnpj: '33.222.111/0001-55', status: 'offline', ultimo_ping: '8min' },
  { cliente: 'Posto Rodoviário MG',   cnpj: '77.888.999/0001-22', status: 'online',  ultimo_ping: '12s'  },
  { cliente: 'Posto Familiar ME',     cnpj: '55.123.456/0001-77', status: 'offline', ultimo_ping: '2h'   },
]

// Período padrão: últimos 30 dias
function defaultRange(): DateRange {
  const to   = new Date(); to.setHours(0,0,0,0)
  const from = new Date(to); from.setDate(from.getDate() - 29)
  return { from, to }
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<DateRange>(defaultRange)

  const fmtPeriod = () => {
    if (!period.from || !period.to) return ''
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    return `${fmt(period.from)} → ${fmt(period.to)}`
  }

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
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-5">
          {kpis.map(({ label, value, delta, icon: Icon, color }) => (
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
          {/* Status dos Agentes */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold">Status dos Agentes</h2>
                  <Badge variant="default">Atualizado em tempo real</Badge>
                </div>
              </CardHeader>
              <div className="divide-y divide-white/5">
                {agentesStatus.map(agente => (
                  <div key={agente.cnpj} className="flex items-center px-6 py-4 gap-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      agente.status === 'online'
                        ? 'bg-[#009c3b] shadow-sm shadow-[#009c3b]'
                        : 'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{agente.cliente}</p>
                      <p className="text-white/40 text-xs font-mono">{agente.cnpj}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {agente.status === 'online'
                        ? <Wifi size={14} className="text-[#009c3b]" />
                        : <WifiOff size={14} className="text-red-400" />}
                      <div className="flex items-center gap-1 text-white/40 text-xs">
                        <Clock size={11} />
                        <span>{agente.ultimo_ping}</span>
                      </div>
                    </div>
                    <Badge variant={agente.status === 'online' ? 'success' : 'danger'}>
                      {agente.status === 'online' ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Atividade Recente */}
          <Card>
            <CardHeader>
              <h2 className="text-white font-semibold">Atividade Recente</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {[
                { acao: 'Template criado',     detalhe: 'Vendas por Hora',    tempo: '2min',  cor: 'text-[#009c3b]'  },
                { acao: 'Agente conectado',    detalhe: 'Posto Central',      tempo: '5min',  cor: 'text-blue-400'   },
                { acao: 'Licença gerada',      detalhe: 'Rede Petro Sul',     tempo: '12min', cor: 'text-purple-400' },
                { acao: 'Preço alterado',      detalhe: 'R$5.89 → R$6.09',   tempo: '18min', cor: 'text-amber-400'  },
                { acao: 'Agente desconectado', detalhe: 'Posto Familiar',     tempo: '2h',    cor: 'text-red-400'    },
                { acao: 'Cliente cadastrado',  detalhe: 'Auto Posto BV',      tempo: '3h',    cor: 'text-[#009c3b]'  },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.cor}`}>{item.acao}</p>
                    <p className="text-white/40 text-xs truncate">{item.detalhe}</p>
                  </div>
                  <span className="text-white/25 text-xs flex-shrink-0">{item.tempo}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
