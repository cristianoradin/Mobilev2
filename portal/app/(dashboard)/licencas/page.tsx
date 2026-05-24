'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Plus, Shield, AlertTriangle, CheckCircle2, Clock, BarChart3, Users, Search } from 'lucide-react'
import type { LicencaItem } from '@/app/api/licencas/route'

const planoBadge: Record<string, 'success' | 'info' | 'default'> = {
  basic: 'default', pro: 'info', enterprise: 'success',
}

const planoLabel: Record<string, string> = {
  basic: 'BASIC', pro: 'PRO', enterprise: 'ENTERPRISE',
}

function diasAteVencer(dateStr: string | null) {
  if (!dateStr) return -Infinity
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ProgressBar({ value, max, color = '#009c3b' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
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
  const [licencas, setLicencas] = useState<LicencaItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca,   setBusca]     = useState('')

  useEffect(() => {
    fetch('/api/licencas')
      .then(r => r.json())
      .then(data => setLicencas(data.licencas ?? []))
      .catch(() => setLicencas([]))
      .finally(() => setLoading(false))
  }, [])

  const licencasFiltradas = busca.trim()
    ? licencas.filter(l =>
        l.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        l.plano.toLowerCase().includes(busca.toLowerCase())
      )
    : licencas

  const ativas   = licencas.filter(l => l.ativa).length
  const inativas = licencas.filter(l => !l.ativa).length
  const expirando30 = licencas.filter(l => {
    const d = diasAteVencer(l.data_expiracao)
    return d > 0 && d <= 30
  }).length

  return (
    <div>
      <TopBar
        title="Licenças"
        subtitle={loading ? 'Carregando...' : `${ativas} ativa${ativas !== 1 ? 's' : ''} · ${inativas} inativa${inativas !== 1 ? 's' : ''}`}
        actions={<Button size="sm"><Plus size={14} />Nova Licença</Button>}
      />

      <div className="p-8 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Licenças Ativas',    value: ativas,          icon: CheckCircle2, color: '#009c3b' },
            { label: 'Clientes Totais',    value: licencas.length, icon: Shield,       color: '#3b82f6' },
            { label: 'Expiram em 30 dias', value: expirando30,     icon: AlertTriangle,color: '#fbbf24' },
            { label: 'Inativas',           value: inativas,        icon: Clock,        color: '#ef4444' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardBody className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${kpi.color}18` }}
                >
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

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-white/30 text-sm">Carregando licenças...</div>
        )}

        {/* Empty state */}
        {!loading && licencas.length === 0 && (
          <div className="text-center py-16 text-white/30 text-sm">
            Nenhum cliente cadastrado ainda.
          </div>
        )}

        {/* Busca */}
        {!loading && licencas.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou plano..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-all"
            />
          </div>
        )}

        {/* Lista */}
        {!loading && (
          <div className="space-y-3">
            {licencasFiltradas.map(lic => {
              const dias     = diasAteVencer(lic.data_expiracao)
              const expirando = dias > 0 && dias <= 30
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
                        {semLicenca
                          ? <Button variant="primary" size="sm">Criar Licença</Button>
                          : (
                            <>
                              <Button variant="secondary" size="sm">Renovar</Button>
                              {lic.ativa
                                ? <Button variant="danger" size="sm">Suspender</Button>
                                : <Button variant="primary" size="sm">Reativar</Button>
                              }
                            </>
                          )
                        }
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
