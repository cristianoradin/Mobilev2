'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { MOCK_CLIENTES } from '@/lib/types'
import { Plus, Shield, AlertTriangle, CheckCircle2, Clock, BarChart3, Users } from 'lucide-react'

interface LicencaMock {
  id: string
  cliente_id: string
  cliente_nome: string
  plano: string
  ativa: boolean
  data_expiracao: string
  max_usuarios: number
  max_graficos: number
  usuarios_ativos: number
  graficos_ativos: number
}

const MOCK_LICENCAS: LicencaMock[] = [
  {
    id: 'lic-001', cliente_id: 'cli-001', cliente_nome: 'Posto Central Ltda',
    plano: 'pro', ativa: true, data_expiracao: '2027-01-15',
    max_usuarios: 10, max_graficos: 25, usuarios_ativos: 4, graficos_ativos: 8,
  },
  {
    id: 'lic-002', cliente_id: 'cli-002', cliente_nome: 'Rede Petro Sul S.A.',
    plano: 'enterprise', ativa: true, data_expiracao: '2027-02-20',
    max_usuarios: 50, max_graficos: 100, usuarios_ativos: 12, graficos_ativos: 31,
  },
  {
    id: 'lic-003', cliente_id: 'cli-003', cliente_nome: 'Posto Familiar ME',
    plano: 'basic', ativa: false, data_expiracao: '2026-03-01',
    max_usuarios: 3, max_graficos: 5, usuarios_ativos: 0, graficos_ativos: 2,
  },
]

const planoBadge: Record<string, 'success' | 'info' | 'purple' | 'default'> = {
  basic: 'default', pro: 'info', enterprise: 'purple',
}

function diasAteVencer(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ProgressBar({ value, max, color = '#009c3b' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  const warning = pct > 80
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: warning ? '#fbbf24' : color }}
        />
      </div>
      <span className="text-white/40 text-xs tabular-nums">{value}/{max}</span>
    </div>
  )
}

export default function LicencasPage() {
  const [licencas] = useState(MOCK_LICENCAS)
  const ativas = licencas.filter(l => l.ativa).length

  return (
    <div>
      <TopBar
        title="Licenças"
        subtitle={`${ativas} ativas · ${licencas.length - ativas} inativas`}
        actions={<Button size="sm"><Plus size={14} />Nova Licença</Button>}
      />

      <div className="p-8 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Licenças Ativas',   value: ativas,           icon: CheckCircle2, color: '#009c3b' },
            { label: 'Clientes Totais',    value: MOCK_CLIENTES.length, icon: Shield,  color: '#3b82f6' },
            { label: 'Expiram em 30 dias', value: licencas.filter(l => { const d = diasAteVencer(l.data_expiracao); return d > 0 && d <= 30 }).length, icon: AlertTriangle, color: '#fbbf24' },
            { label: 'Vencidas',          value: licencas.filter(l => !l.ativa).length, icon: Clock, color: '#ef4444' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}18` }}>
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

        {/* Lista */}
        <div className="space-y-3">
          {licencas.map(lic => {
            const dias = diasAteVencer(lic.data_expiracao)
            const expirando = dias > 0 && dias <= 30
            return (
              <Card key={lic.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${lic.ativa ? 'bg-[#009c3b]/10 border border-[#009c3b]/20' : 'bg-white/5 border border-white/10'}`}>
                      <Shield size={18} className={lic.ativa ? 'text-[#009c3b]' : 'text-white/30'} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-white font-semibold text-sm">{lic.cliente_nome}</p>
                        <Badge variant={planoBadge[lic.plano]}>{lic.plano.toUpperCase()}</Badge>
                        <Badge variant={lic.ativa ? 'success' : 'danger'}>{lic.ativa ? 'Ativa' : 'Inativa'}</Badge>
                        {expirando && <Badge variant="warning">Expira em {dias}d</Badge>}
                      </div>

                      <p className="text-white/40 text-xs mb-3">
                        Vence em {new Date(lic.data_expiracao).toLocaleDateString('pt-BR')}
                        {dias > 0 ? ` · ${dias} dias restantes` : ' · Expirada'}
                      </p>

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
                            <span className="text-white/40 text-xs">Gráficos</span>
                          </div>
                          <ProgressBar value={lic.graficos_ativos} max={lic.max_graficos} />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="secondary" size="sm">Renovar</Button>
                      {lic.ativa
                        ? <Button variant="danger" size="sm">Suspender</Button>
                        : <Button variant="primary" size="sm">Reativar</Button>
                      }
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
