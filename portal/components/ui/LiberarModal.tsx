'use client'
/**
 * LiberarModal — controla acesso de clientes a um template de gráfico ou dashboard.
 * Exibe:
 *   - Toggle "Público para todos"
 *   - Quando não público: lista de clientes com checkboxes
 */
import { useState, useEffect } from 'react'
import { X, Globe, Lock, Users, Loader2, Building2, Check } from 'lucide-react'
import { Button } from './Button'
import { Badge }  from './Badge'

export interface LiberacaoState {
  is_publico:  boolean
  cliente_ids: string[]   // vazio = nenhum; preenchido = clientes específicos
}

interface ClienteBasic {
  id:   string
  nome: string
  ativo: boolean
}

interface LiberarModalProps {
  itemNome:   string
  itemTipo:   'template' | 'dashboard'
  liberacao:  LiberacaoState
  onSalvar:   (nova: LiberacaoState) => void
  onFechar:   () => void
}

export function LiberarModal({ itemNome, itemTipo, liberacao, onSalvar, onFechar }: LiberarModalProps) {
  const [estado,     setEstado]     = useState<LiberacaoState>(liberacao)
  const [clientes,   setClientes]   = useState<ClienteBasic[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando,   setSalvando]   = useState(false)

  // Carrega lista de clientes ao abrir
  useEffect(() => {
    setCarregando(true)
    fetch('/api/clientes')
      .then(r => r.json())
      .then((d: { clientes?: ClienteBasic[] }) => setClientes((d.clientes ?? []).filter(c => c.ativo)))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  function toggleCliente(id: string) {
    setEstado(prev => ({
      ...prev,
      cliente_ids: prev.cliente_ids.includes(id)
        ? prev.cliente_ids.filter(x => x !== id)
        : [...prev.cliente_ids, id],
    }))
  }

  function selecionarTodos() {
    setEstado(prev => ({ ...prev, cliente_ids: clientes.map(c => c.id) }))
  }

  function limparTodos() {
    setEstado(prev => ({ ...prev, cliente_ids: [] }))
  }

  async function handleSalvar() {
    setSalvando(true)
    // Simula chamada à API — aqui entraria o fetch real
    await new Promise(r => setTimeout(r, 400))
    onSalvar(estado)
    setSalvando(false)
  }

  const badgePublico = estado.is_publico
    ? <Badge variant="success">Público para todos</Badge>
    : estado.cliente_ids.length > 0
      ? <Badge variant="info">{estado.cliente_ids.length} cliente(s) liberado(s)</Badge>
      : <Badge variant="default">Restrito</Badge>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-semibold text-base">Liberar {itemTipo === 'template' ? 'Template' : 'Dashboard'}</h2>
              {badgePublico}
            </div>
            <p className="text-white/40 text-xs truncate">{itemNome}</p>
          </div>
          <button onClick={onFechar} className="text-white/40 hover:text-white transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Toggle público */}
          <div
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
              estado.is_publico
                ? 'border-[#009c3b]/40 bg-[#009c3b]/8'
                : 'border-white/8 bg-white/3 hover:border-white/15'
            }`}
            onClick={() => setEstado(prev => ({ ...prev, is_publico: !prev.is_publico, cliente_ids: [] }))}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                estado.is_publico ? 'bg-[#009c3b]/20' : 'bg-white/5'
              }`}>
                <Globe size={18} className={estado.is_publico ? 'text-[#009c3b]' : 'text-white/40'} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Público para todos os clientes</p>
                <p className="text-white/40 text-xs mt-0.5">Qualquer cliente ativo poderá acessar</p>
              </div>
            </div>
            {/* Toggle visual */}
            <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
              estado.is_publico ? 'bg-[#009c3b]' : 'bg-white/15'
            }`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                estado.is_publico ? 'left-6' : 'left-1'
              }`} />
            </div>
          </div>

          {/* Lista de clientes */}
          {!estado.is_publico && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-white/40" />
                  <p className="text-white/70 text-sm font-medium">Clientes com acesso</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={selecionarTodos} className="text-[#009c3b] text-xs hover:underline">Todos</button>
                  <span className="text-white/20">·</span>
                  <button onClick={limparTodos} className="text-white/40 text-xs hover:underline">Nenhum</button>
                </div>
              </div>

              {carregando ? (
                <div className="flex items-center gap-2 py-6 text-white/30 text-sm justify-center">
                  <Loader2 size={16} className="animate-spin" />Carregando clientes…
                </div>
              ) : clientes.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">Nenhum cliente ativo cadastrado</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {clientes.map(c => {
                    const sel = estado.cliente_ids.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          sel
                            ? 'border-[#009c3b]/40 bg-[#009c3b]/8'
                            : 'border-white/6 bg-white/2 hover:border-white/12'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          sel ? 'bg-[#009c3b] border-[#009c3b]' : 'border-white/20'
                        }`}>
                          {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={sel}
                          onChange={() => toggleCliente(c.id)}
                        />
                        <Building2 size={14} className={sel ? 'text-[#009c3b]' : 'text-white/30'} />
                        <span className={`flex-1 text-sm ${sel ? 'text-white' : 'text-white/60'}`}>{c.nome}</span>
                        {sel && (
                          <Users size={12} className="text-[#009c3b] flex-shrink-0" />
                        )}
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Resumo */}
              {estado.cliente_ids.length > 0 && (
                <p className="text-white/40 text-xs mt-2 text-center">
                  {estado.cliente_ids.length} de {clientes.length} cliente(s) selecionado(s)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSalvar} loading={salvando}>
            {estado.is_publico ? (
              <><Globe size={14} />Publicar para Todos</>
            ) : estado.cliente_ids.length > 0 ? (
              <><Users size={14} />Salvar Liberação</>
            ) : (
              <><Lock size={14} />Salvar como Restrito</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
