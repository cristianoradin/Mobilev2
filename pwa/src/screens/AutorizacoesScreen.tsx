import { Shield, Check, X, Clock, Fuel, Wifi, WifiOff } from 'lucide-react'
import { Card }         from '@/components/ui/Card'
import { Badge }        from '@/components/ui/Badge'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useAuth } from '@/core/auth/AuthContext'
import { useMQTT } from '@/core/mqtt/MQTTContext'
import { useAutorizacoes } from '@/core/autorizacoes/useAutorizacoes'
import type { Solicitacao } from '@/core/autorizacoes/useAutorizacoes'

// ── Utilitários ───────────────────────────────────────────────────────────────
function tempoPassado(ts: number): string {
  const segundos = Math.floor((Date.now() - ts) / 1000)
  if (segundos < 60)   return `${segundos}s atrás`
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min atrás`
  return `${Math.floor(segundos / 3600)}h atrás`
}

// ── Card de solicitação pendente ──────────────────────────────────────────────
function CardSolicitacao({
  sol, podeAutorizar, isProcessando, cmdLoading, onResponder,
}: {
  sol: Solicitacao
  podeAutorizar: boolean
  isProcessando: boolean
  cmdLoading: boolean
  onResponder: (sol: Solicitacao, aprovado: boolean) => void
}) {
  const valorDesconto = sol.valor_total * (sol.desconto_solicitado / 100)
  const valorFinal    = sol.valor_total - valorDesconto

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue/20 rounded-xl flex items-center justify-center">
            <Fuel size={18} className="text-blue" />
          </div>
          <div>
            <p className="text-ink font-semibold">Bico #{sol.bico}</p>
            <p className="text-ink/40 text-xs">{sol.operador}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-ink/40 text-xs">
          <Clock size={12} />
          <span>{tempoPassado(sol.timestamp)}</span>
        </div>
      </div>

      {/* Detalhes financeiros */}
      <div className="bg-surface2 rounded-xl p-4 space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-ink/50">Volume</span>
          <span className="text-ink font-medium">{sol.litros.toFixed(1)} L</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink/50">Valor Total</span>
          <span className="text-ink font-medium">R$ {sol.valor_total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-rim pt-2">
          <span className="text-yellow/80">Desconto Solicitado</span>
          <span className="text-yellow font-bold">
            {sol.desconto_solicitado}% (−R$ {valorDesconto.toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink/50">Valor Final</span>
          <span className="text-primary font-bold text-base">R$ {valorFinal.toFixed(2)}</span>
        </div>
      </div>

      {/* Ações */}
      {podeAutorizar ? (
        <div className="flex gap-3">
          <button
            onClick={() => onResponder(sol, false)}
            disabled={isProcessando || cmdLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-danger/10 border border-danger/30 text-danger rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            <X size={18} />
            Rejeitar
          </button>
          <button
            onClick={() => onResponder(sol, true)}
            disabled={isProcessando || cmdLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/30"
          >
            {isProcessando
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Check size={18} /> Aprovar</>
            }
          </button>
        </div>
      ) : (
        <div className="bg-ink/5 rounded-xl p-3 text-center">
          <p className="text-ink/40 text-sm">Sem permissão para autorizar</p>
        </div>
      )}
    </Card>
  )
}

// ── Tela principal ────────────────────────────────────────────────────────────
export function AutorizacoesScreen() {
  const { session }                  = useAuth()
  const { connected }                = useMQTT()
  const { pendentes, historico, processando, cmdLoading, responder } = useAutorizacoes()

  const podeAutorizar = session?.role === 'dono' || session?.role === 'gerente'

  return (
    <div className="pt-4 space-y-5">
      <ScreenHeader
        title="Autorizações"
        subtitle="Descontos aguardando aprovação"
        action={
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
              connected
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-danger/10 border-danger/30 text-danger'
            }`}>
              {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
              {connected ? 'Conectado' : 'Offline'}
            </div>
            {pendentes.length > 0 && (
              <div className="w-8 h-8 bg-yellow/20 border border-yellow/40 rounded-full flex items-center justify-center">
                <span className="text-yellow font-bold text-sm">{pendentes.length}</span>
              </div>
            )}
          </div>
        }
      />

      {/* Pendentes */}
      {pendentes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Shield size={28} className="text-primary" />
          </div>
          <p className="text-ink/50 text-sm">Nenhuma solicitação pendente</p>
          {connected && (
            <p className="text-ink/25 text-xs">Aguardando solicitações do posto…</p>
          )}
          {!connected && (
            <p className="text-yellow/60 text-xs">Sem conexão com o posto</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.map(sol => (
            <CardSolicitacao
              key={sol.id}
              sol={sol}
              podeAutorizar={podeAutorizar}
              isProcessando={processando === sol.id}
              cmdLoading={cmdLoading}
              onResponder={responder}
            />
          ))}
        </div>
      )}

      {/* Histórico da sessão */}
      {historico.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-3">
            Histórico desta sessão
          </h2>
          <div className="space-y-2">
            {historico.map(sol => (
              <div
                key={sol.id}
                className="flex items-center gap-3 bg-surface border border-rim rounded-xl p-4"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  sol.status === 'aprovado' ? 'bg-primary/20' : 'bg-danger/20'
                }`}>
                  {sol.status === 'aprovado'
                    ? <Check size={14} className="text-primary" />
                    : <X size={14} className="text-danger" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-medium">
                    Bico #{sol.bico} — {sol.desconto_solicitado}% desc.
                  </p>
                  <p className="text-ink/40 text-xs">{tempoPassado(sol.timestamp)}</p>
                </div>
                <Badge variant={sol.status === 'aprovado' ? 'success' : 'danger'}>
                  {sol.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
