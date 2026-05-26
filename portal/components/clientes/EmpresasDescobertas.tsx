'use client'
/**
 * EmpresasDescobertas — bloco no detalhe do cliente que mostra empresas
 * descobertas pelo agente no banco local + permite vincular/criar.
 */
import { useState, useEffect, useCallback } from 'react'
import { Database, RefreshCw, Link2, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Descoberta {
  id:                  number
  empcodigo:           number | string
  empnome:             string
  empcnpjClean:        string | null
  vinculadaEmpresaId:  number | null
  vinculadaNome:       string | null
  firstSeen:           string
  lastSeen:            string
}

interface EmpresaPortal {
  id:         number
  nome:       string
  is_master?: boolean
  codigoErp?: number
  codigo_erp?: number
}

interface Props {
  clienteId: string
  empresas:  EmpresaPortal[]    // empresas já cadastradas no portal pra mostrar opções de vínculo
  onChange?: () => void          // chama após vincular/criar pra parent recarregar
}

export function EmpresasDescobertas({ clienteId, empresas, onChange }: Props) {
  const [lista,      setLista]      = useState<Descoberta[]>([])
  const [loading,    setLoading]    = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [busy,       setBusy]       = useState<number | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/empresas-descobertas`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json() as { empresas: Descoberta[] }
      setLista(d.empresas ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro carregando')
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => { load() }, [load])

  async function discoverNow() {
    setDiscovering(true)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/discover-empresas`, { method: 'POST' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setError(j.error ?? 'Falha ao acionar discovery')
        return
      }
      // Agente responde em alguns segundos — recarrega após 5s
      setTimeout(() => { load(); setDiscovering(false) }, 5000)
    } catch {
      setError('Erro de rede')
      setDiscovering(false)
    }
  }

  async function vincular(d: Descoberta, opts: { empresa_id?: number; criar_nova?: boolean }) {
    setBusy(d.id)
    try {
      const r = await fetch(`/api/empresas-descobertas/${d.id}/vincular`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(opts),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error ?? 'Falha ao vincular')
        return
      }
      await load()
      onChange?.()
    } finally {
      setBusy(null)
    }
  }

  async function autoVincularTudo() {
    const naoVinc = lista.filter(d => !d.vinculadaEmpresaId)
    if (!naoVinc.length) return
    if (!confirm(`Auto-vincular ${naoVinc.length} empresa(s)? Cada uma criará uma entrada nova no portal.`)) return
    for (const d of naoVinc) {
      await vincular(d, { criar_nova: true })
    }
  }

  return (
    <div className="border-t border-white/8 pt-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Database size={11} />Empresas descobertas
        </p>
        <button
          onClick={discoverNow}
          disabled={discovering}
          className="text-[#009c3b] hover:text-[#00b548] transition-colors disabled:opacity-40"
          title="Pedir ao agente pra rodar discovery agora"
        >
          <RefreshCw size={13} className={discovering ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-[10px] mb-2 flex items-center gap-1.5">
          <AlertCircle size={11} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-1.5 py-2 text-white/30 text-xs">
          <Loader2 size={10} className="animate-spin" />Carregando…
        </div>
      ) : lista.length === 0 ? (
        <p className="text-white/25 text-xs italic py-1">
          {discovering ? 'Aguardando agente…' : 'Nenhuma descoberta — o agente reporta no startup + a cada 6h'}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {lista.map(d => {
              const isLinked = d.vinculadaEmpresaId != null
              const empOptions = empresas.filter(e => !lista.some(x => x.vinculadaEmpresaId === e.id && x.id !== d.id))
              return (
                <div
                  key={d.id}
                  className={cn(
                    'py-2 px-2 rounded-lg border',
                    isLinked
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-amber-500/5 border-amber-500/20',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isLinked
                      ? <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      : <AlertCircle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/85 text-xs font-medium truncate">{d.empnome}</span>
                        <span className="text-white/30 text-[10px] font-mono flex-shrink-0">#{d.empcodigo}</span>
                      </div>
                      {d.empcnpjClean && (
                        <div className="text-white/35 text-[10px] font-mono">{d.empcnpjClean}</div>
                      )}
                      {isLinked && d.vinculadaNome && (
                        <div className="text-emerald-400/70 text-[10px] mt-0.5">
                          → vinculada a "{d.vinculadaNome}"
                        </div>
                      )}
                    </div>
                  </div>
                  {!isLinked && (
                    <div className="flex gap-1.5 mt-1.5 pl-5">
                      <button
                        onClick={() => vincular(d, { criar_nova: true })}
                        disabled={busy === d.id}
                        className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                        title="Criar nova empresa no portal com este código ERP"
                      >
                        {busy === d.id ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                        Criar
                      </button>
                      {empOptions.length > 0 && (
                        <>
                          <span className="text-white/20 text-[10px]">|</span>
                          <select
                            onChange={e => {
                              const id = Number(e.target.value)
                              if (id > 0) vincular(d, { empresa_id: id })
                              e.target.value = ''
                            }}
                            defaultValue=""
                            disabled={busy === d.id}
                            className="bg-transparent text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer outline-none"
                          >
                            <option value="" className="bg-[#111]">↪ Vincular a existente…</option>
                            {empOptions.map(e => (
                              <option key={e.id} value={e.id} className="bg-[#111]">{e.nome}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {lista.some(d => !d.vinculadaEmpresaId) && (
            <button
              onClick={autoVincularTudo}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 py-1.5 rounded border border-emerald-500/20 hover:bg-emerald-500/5 transition-colors"
            >
              <Link2 size={11} />
              Auto-vincular todas (cria novas)
            </button>
          )}
        </>
      )}
    </div>
  )
}
