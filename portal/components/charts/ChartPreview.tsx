'use client'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ChartMetadata } from '@/lib/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

// Dados mock para preview — serão substituídos por dados reais via agente
function generateMockData(meta: ChartMetadata) {
  if (meta.chart_type === 'pie') {
    return [
      { [meta.axes.x.field]: 'Gasolina', [meta.axes.y[0]?.field ?? 'valor']: 45 },
      { [meta.axes.x.field]: 'Etanol',   [meta.axes.y[0]?.field ?? 'valor']: 30 },
      { [meta.axes.x.field]: 'Diesel',   [meta.axes.y[0]?.field ?? 'valor']: 25 },
    ]
  }
  if (meta.chart_type === 'gauge') {
    return [{ [meta.axes.y[0]?.field ?? 'nivel']: 72 }]
  }
  return Array.from({ length: 8 }, (_, i) => {
    const row: Record<string, unknown> = {
      [meta.axes.x.field]: `${(i * 3).toString().padStart(2, '0')}:00`,
    }
    meta.axes.y.forEach(y => {
      row[y.field] = Math.floor(Math.random() * 5000 + 1000)
    })
    return row
  })
}

const palette = ['#009c3b', '#3b82f6', '#f97316', '#fbbf24', '#8b5cf6']

function buildOption(meta: ChartMetadata, data: Record<string, unknown>[]) {
  if (meta.chart_type === 'pie') {
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: '#1a1a1a', textStyle: { color: '#fff' } },
      legend: { orient: 'vertical', right: 10, textStyle: { color: '#a0a0a0' } },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: data.map((r, i) => ({
          name: String(r[meta.axes.x.field]),
          value: r[meta.axes.y[0]?.field ?? 'valor'],
          itemStyle: { color: palette[i % palette.length] },
        })),
        label: { color: '#a0a0a0', fontSize: 11 },
      }],
    }
  }

  if (meta.chart_type === 'gauge') {
    const val = Number(data[0]?.[meta.axes.y[0]?.field ?? 'nivel'] ?? 0)
    return {
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
        data: [{ value: val, name: meta.axes.y[0]?.label ?? '%' }],
        axisLine: { lineStyle: { width: 18, color: [[0.2, '#ef4444'], [0.5, '#fbbf24'], [1, '#009c3b']] } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: '#a0a0a0', fontSize: 10 },
        title: { color: '#a0a0a0', fontSize: 12 },
        detail: { color: '#fff', fontSize: 26, fontWeight: 700, formatter: '{value}%' },
      }],
    }
  }

  const xValues = data.map(r => r[meta.axes.x.field])
  const series = meta.axes.y.map((y, i) => ({
    name: y.label,
    type: meta.chart_type === 'area' ? 'line' : meta.chart_type,
    data: data.map(r => r[y.field]),
    smooth: meta.chart_type === 'line' || meta.chart_type === 'area',
    itemStyle: { color: y.color ?? palette[i % palette.length] },
    ...(meta.chart_type === 'area' ? { areaStyle: { opacity: 0.12 } } : {}),
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a1a', textStyle: { color: '#fff' } },
    legend: meta.display.show_legend
      ? { data: meta.axes.y.map(y => y.label), textStyle: { color: '#a0a0a0' }, bottom: 0 }
      : undefined,
    grid: { left: 12, right: 12, top: 12, bottom: meta.display.show_legend ? 40 : 20, containLabel: true },
    xAxis: { type: 'category', data: xValues, axisLabel: { color: '#a0a0a0', fontSize: 11 }, axisLine: { lineStyle: { color: '#2a2a2a' } }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#a0a0a0', fontSize: 11 }, splitLine: { lineStyle: { color: '#2a2a2a', type: 'dashed' } } },
    series,
  }
}

const HEIGHT = { sm: 200, md: 280, lg: 380 }

interface Props {
  metadata: ChartMetadata
}

export function ChartPreview({ metadata }: Props) {
  const data = useMemo(() => generateMockData(metadata), [metadata.chart_type, metadata.axes.y.length])
  const option = useMemo(() => buildOption(metadata, data), [metadata, data])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8">
        <span className="text-white/40 text-xs">Preview — dados mock</span>
        <span className="text-white/30 text-xs capitalize">{metadata.chart_type}</span>
      </div>
      <div className="flex-1 p-4 bg-[#111111]">
        <ReactECharts
          option={option}
          style={{ height: HEIGHT[metadata.display.height], width: '100%' }}
          theme="dark"
          notMerge
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}
