'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const SQL_SNIPPET = `-- Template: Vendas por Hora do Dia
-- Use :empresas_filtradas como placeholder para isolamento multiempresa
-- O CNPJ do cliente é injetado automaticamente pelo agente

SELECT
  TO_CHAR(data_hora, 'HH24:00') AS hora,
  SUM(CASE WHEN combustivel = 'gasolina' THEN valor ELSE 0 END) AS gasolina,
  SUM(CASE WHEN combustivel = 'etanol'   THEN valor ELSE 0 END) AS etanol,
  SUM(CASE WHEN combustivel = 'diesel'   THEN valor ELSE 0 END) AS diesel
FROM vendas
WHERE
  empresa_id IN (:empresas_filtradas)
  AND data_hora >= CURRENT_DATE
GROUP BY TO_CHAR(data_hora, 'HH24:00')
ORDER BY hora`

interface SQLEditorProps {
  value: string
  onChange: (v: string) => void
}

export function SQLEditor({ value, onChange }: SQLEditorProps) {
  const [hasPlaceholder, setHasPlaceholder] = useState(value.includes(':empresas_filtradas'))

  function handleChange(v: string | undefined) {
    const sql = v ?? ''
    onChange(sql)
    setHasPlaceholder(sql.includes(':empresas_filtradas'))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barra de status */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8">
        <span className="text-white/40 text-xs font-mono">SQL Query</span>
        <div className="flex items-center gap-2">
          {hasPlaceholder
            ? <span className="flex items-center gap-1.5 text-[#009c3b] text-xs">
                <CheckCircle2 size={12} />
                :empresas_filtradas presente
              </span>
            : <span className="flex items-center gap-1.5 text-amber-400 text-xs">
                <AlertCircle size={12} />
                Adicione :empresas_filtradas para isolamento
              </span>
          }
        </div>
      </div>

      {/* Monaco */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language="sql"
          value={value || SQL_SNIPPET}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: 'auto', horizontal: 'auto' },
          }}
        />
      </div>
    </div>
  )
}
