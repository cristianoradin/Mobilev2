import { useState } from 'react'
import { DollarSign, Check, X, AlertTriangle } from 'lucide-react'
import { Card }         from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useCommand }   from '@/hooks/useCommand'
import { useAuth }    from '@/core/auth/AuthContext'
import { cn }         from '@/lib/cn'

const combustiveis = [
  { id: 1, nome: 'Gasolina Comum',     preco_atual: 5.89, unidade: 'L' },
  { id: 2, nome: 'Gasolina Aditivada', preco_atual: 6.29, unidade: 'L' },
  { id: 3, nome: 'Etanol',             preco_atual: 4.15, unidade: 'L' },
  { id: 4, nome: 'Diesel S10',         preco_atual: 6.79, unidade: 'L' },
  { id: 5, nome: 'Diesel Comum',       preco_atual: 6.49, unidade: 'L' },
]

export function TrocaPrecoScreen() {
  const { session }                     = useAuth()
  const { send, loading: cmdLoading }   = useCommand()
  const [editando, setEditando]         = useState<number | null>(null)
  const [novoPreco, setNovoPreco]       = useState('')
  const [resultado, setResultado]       = useState<{ id: number; ok: boolean } | null>(null)

  const podeEditar = session?.role === 'dono' || session?.role === 'gerente'

  function iniciarEdicao(id: number, precoAtual: number) {
    setEditando(id); setNovoPreco(precoAtual.toFixed(2)); setResultado(null)
  }
  function cancelar() { setEditando(null); setNovoPreco('') }

  async function confirmar(c: typeof combustiveis[0]) {
    const valor = parseFloat(novoPreco.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) return
    const ok = await send('PRECO_UPDATE', {
      produto_id: c.id, produto_nome: c.nome,
      preco_anterior: c.preco_atual, novo_preco: valor,
      motivo: 'Atualização manual via PWA',
    })
    setResultado({ id: c.id, ok })
    setEditando(null); setNovoPreco('')
  }

  return (
    <div className="pt-4 space-y-5">
      <ScreenHeader title="Troca de Preço" subtitle="Atualização remota de valores" />

      {!podeEditar && (
        <div className="bg-yellow/10 border border-yellow/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow flex-shrink-0 mt-0.5" />
          <p className="text-ink/70 text-sm">Apenas Donos e Gerentes podem alterar preços.</p>
        </div>
      )}

      <div className="space-y-3">
        {combustiveis.map(c => {
          const isEditando  = editando === c.id
          const feedbackOk  = resultado?.id === c.id && resultado.ok
          const feedbackFail = resultado?.id === c.id && !resultado.ok

          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink font-semibold">{c.nome}</p>
                  <p className="text-ink/40 text-sm mt-0.5">
                    Atual: <span className="text-ink font-medium">R$ {c.preco_atual.toFixed(2)}/{c.unidade}</span>
                  </p>
                </div>
                {!isEditando && podeEditar && (
                  <button
                    onClick={() => iniciarEdicao(c.id, c.preco_atual)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95',
                      feedbackOk   ? 'bg-primary/20 text-primary' :
                      feedbackFail ? 'bg-danger/20  text-danger'  :
                                     'bg-orange/20  text-orange'
                    )}
                  >
                    {feedbackOk   ? <><Check size={14} /> Atualizado</> :
                     feedbackFail ? <><X size={14} />    Falhou</>      :
                                    <><DollarSign size={14} /> Alterar</>}
                  </button>
                )}
              </div>

              {isEditando && (
                <div className="mt-4 pt-4 border-t border-rim">
                  <label className="block text-xs text-ink/50 mb-2 uppercase tracking-wider">
                    Novo Preço (R$/{c.unidade})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={novoPreco}
                      onChange={e => setNovoPreco(e.target.value)}
                      step="0.01" min="0"
                      className="flex-1 bg-surface2 border border-rim2 rounded-xl px-4 py-3 text-ink text-lg font-bold focus:outline-none focus:border-orange transition-colors"
                      autoFocus
                    />
                    <button
                      onClick={() => confirmar(c)}
                      disabled={cmdLoading}
                      className="px-4 py-3 bg-primary rounded-xl text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
                    >
                      {cmdLoading
                        ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                        : <Check size={20} />}
                    </button>
                    <button
                      onClick={cancelar}
                      className="px-4 py-3 bg-rim rounded-xl text-ink/70 transition-all active:scale-95"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {novoPreco && !isNaN(parseFloat(novoPreco)) && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-ink/40 text-xs">Diferença:</span>
                      <span className={`text-xs font-semibold ${parseFloat(novoPreco) > c.preco_atual ? 'text-danger' : 'text-primary'}`}>
                        {(parseFloat(novoPreco) - c.preco_atual) >= 0 ? '+' : ''}
                        R$ {(parseFloat(novoPreco) - c.preco_atual).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
