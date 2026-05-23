'use client'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ChartMetadata } from '@/lib/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface WfItem { label: string; value: number; type: 'positive' | 'negative' | 'total' }

const MOCK_ITEMS: WfItem[] = [
  { label: 'Faturamento Bruto',  value:  45000, type: 'positive' },
  { label: 'Custo do Produto',   value: -28000, type: 'negative' },
  { label: 'PIS / COFINS',       value:  -4500, type: 'negative' },
  { label: 'Despesas Operac.',   value:  -5200, type: 'negative' },
  { label: 'Margem Líquida',     value:      0, type: 'total'    },
]

function buildWaterfall(items: WfItem[]) {
  const helpers:   number[] = []
  const positives: number[] = []
  const negatives: number[] = []
  const totals:    number[] = []

  let running = 0
  items.forEach(item => {
    if (item.type === 'total') {
      helpers.push(0);   positives.push(0); negatives.push(0); totals.push(running)
    } else if (item.value >= 0) {
      helpers.push(running);  positives.push(item.value); negatives.push(0); totals.push(0)
      running += item.value
    } else {
      running += item.value
      helpers.push(running);  positives.push(0); negatives.push(-item.value); totals.push(0)
    }
  })
  return { helpers, positives, negatives, totals }
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function WaterfallPreview({ metadata }: { metadata: ChartMetadata }) {
  const cats = useMemo(() => MOCK_ITEMS.map(i => i.label), [])
  const { helpers, positives, negatives, totals } = useMemo(
    () => buildWaterfall(MOCK_ITEMS), []
  )

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      textStyle: { color: '#fff', fontSize: 11 },
      axisPointer: { type: 'shadow' },
      formatter: (params: { seriesName: string; value: number; dataIndex: number }[]) => {
        const item  = MOCK_ITEMS[params[0]?.dataIndex]
        if (!item) return ''
        const real  = item.type === 'total'
          ? totals[params[0].dataIndex]
          : item.value
        const color = item.type === 'total' ? '#60a5fa'
          : real >= 0 ? '#4ade80' : '#f87171'
        return `<b>${item.label}</b><br/><span style="color:${color}">${fmtBRL(real)}</span>`
      },
    },
    grid: { left: 12, right: 12, top: 20, bottom: 56, containLabel: true },
    xAxis: {
      type: 'category',
      data: cats,
      axisLabel: { color: '#666', fontSize: 10, interval: 0 },
      axisLine: { lineStyle: { color: '#1e1e1e' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#555',
        fontSize: 10,
        formatter: (v: number) => `R$${(v / 1000).toFixed(0)}k`,
      },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      // Barra invisível — offset
      {
        name: 'helper',
        type: 'bar',
        stack: 'wf',
        silent: true,
        data: helpers,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
      },
      // Entrada (verde)
      {
        name: 'Entrada',
        type: 'bar',
        stack: 'wf',
        barMaxWidth: 52,
        data: positives,
        itemStyle: {
          color: '#009c3b',
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true, position: 'top', fontSize: 10, color: '#4ade80',
          formatter: (p: { value: number }) =>
            p.value === 0 ? '' : fmtBRL(p.value),
        },
      },
      // Saída (vermelho)
      {
        name: 'Saída',
        type: 'bar',
        stack: 'wf',
        barMaxWidth: 52,
        data: negatives,
        itemStyle: {
          color: '#dc2626',
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true, position: 'top', fontSize: 10, color: '#f87171',
          formatter: (p: { value: number }) =>
            p.value === 0 ? '' : `-${fmtBRL(p.value)}`,
        },
      },
      // Total (azul)
      {
        name: 'Total',
        type: 'bar',
        stack: 'wf',
        barMaxWidth: 52,
        data: totals,
        itemStyle: {
          color: '#2563eb',
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true, position: 'top', fontSize: 11, fontWeight: 700, color: '#60a5fa',
          formatter: (p: { value: number }) =>
            p.value === 0 ? '' : fmtBRL(p.value),
        },
      },
    ],
  }), [cats, helpers, positives, negatives, totals])

  return (
    <div className="h-full flex flex-col bg-[#111]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className="text-white/40 text-xs">Preview — demonstrativo de resultado simulado</span>
        <span className="text-white/30 text-xs">Waterfall · {cats.length} componentes</span>
      </div>
      <div className="flex-1 p-2">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          theme="dark"
          notMerge
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}
