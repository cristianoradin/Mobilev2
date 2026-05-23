import ReactECharts from 'echarts-for-react'
import type { ChartMetadata } from '@/lib/contracts'
import { colors } from '@/lib/theme'

interface Props {
  metadata: ChartMetadata
  data: Record<string, unknown>[]
  loading?: boolean
}

const HEIGHT_MAP = { sm: 200, md: 300, lg: 400 }

export function DynamicChart({ metadata, data, loading = false }: Props) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-white/5"
        style={{ height: HEIGHT_MAP[metadata.display.height] }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-white/50">Carregando dados...</span>
        </div>
      </div>
    )
  }

  const option = buildOption(metadata, data)

  return (
    <div style={{ height: HEIGHT_MAP[metadata.display.height] }}>
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        theme="dark"
        notMerge
        opts={{ renderer: 'canvas', devicePixelRatio: window.devicePixelRatio }}
      />
    </div>
  )
}

function buildOption(meta: ChartMetadata, data: Record<string, unknown>[]) {
  const palette = [colors.primary, colors.blue, colors.orange, colors.yellow, colors.purple]

  if (meta.chart_type === 'pie') {
    return buildPie(meta, data, palette)
  }
  if (meta.chart_type === 'gauge') {
    return buildGauge(meta, data)
  }
  return buildCartesian(meta, data, palette)
}

function buildCartesian(meta: ChartMetadata, data: Record<string, unknown>[], palette: string[]) {
  const xValues = data.map(row => row[meta.axes.x.field])

  const series = meta.axes.y.map((yAxis, i) => {
    const base = {
      name: yAxis.label,
      type: meta.chart_type === 'area' ? 'line' : meta.chart_type,
      data: data.map(row => row[yAxis.field]),
      smooth: meta.chart_type === 'line' || meta.chart_type === 'area',
      itemStyle: { color: yAxis.color ?? palette[i % palette.length] },
    }
    if (meta.chart_type === 'area' || meta.display.gradient) {
      return { ...base, areaStyle: { opacity: 0.15 } }
    }
    return base
  })

  return {
    backgroundColor: 'transparent',
    tooltip: meta.display.show_tooltip
      ? { trigger: 'axis', backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', textStyle: { color: '#fff' } }
      : undefined,
    legend: meta.display.show_legend
      ? { data: meta.axes.y.map(y => y.label), textStyle: { color: '#a0a0a0' }, bottom: 0 }
      : undefined,
    grid: { left: 12, right: 12, top: meta.display.show_legend ? 16 : 8, bottom: meta.display.show_legend ? 40 : 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: xValues,
      axisLabel: { color: '#a0a0a0', fontSize: 11, formatter: formatAxisLabel(meta.axes.x.format) },
      axisLine: { lineStyle: { color: '#2a2a2a' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a0a0a0', fontSize: 11, formatter: formatAxisLabel(meta.axes.y[0]?.format) },
      splitLine: { lineStyle: { color: '#2a2a2a', type: 'dashed' } },
    },
    series,
  }
}

function buildPie(meta: ChartMetadata, data: Record<string, unknown>[], palette: string[]) {
  const pieData = data.map((row, i) => ({
    name: String(row[meta.axes.x.field] ?? `Item ${i + 1}`),
    value: row[meta.axes.y[0]?.field ?? 'value'],
    itemStyle: { color: palette[i % palette.length] },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: meta.display.show_tooltip
      ? { trigger: 'item', backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', textStyle: { color: '#fff' } }
      : undefined,
    legend: meta.display.show_legend
      ? { orient: 'vertical', right: 10, textStyle: { color: '#a0a0a0' } }
      : undefined,
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      data: pieData,
      label: { color: '#a0a0a0', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  }
}

function buildGauge(meta: ChartMetadata, data: Record<string, unknown>[]) {
  const value = Number(data[0]?.[meta.axes.y[0]?.field ?? 'value'] ?? 0)
  const color = value > 50 ? colors.primary : value > 20 ? colors.yellow : colors.danger

  return {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      data: [{ value, name: meta.axes.y[0]?.label ?? '%' }],
      pointer: { itemStyle: { color } },
      axisLine: {
        lineStyle: {
          width: 20,
          color: [[0.2, colors.danger], [0.5, colors.yellow], [1, colors.primary]],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: '#a0a0a0', fontSize: 10 },
      title: { offsetCenter: [0, '70%'], color: '#a0a0a0', fontSize: 13 },
      detail: { offsetCenter: [0, '40%'], color: '#ffffff', fontSize: 28, fontWeight: 700, formatter: '{value}%' },
    }],
  }
}

function formatAxisLabel(format?: string): ((v: unknown) => string) | undefined {
  if (!format) return undefined
  if (format === 'currency') return (v) => `R$ ${Number(v).toFixed(2)}`
  if (format === 'number')   return (v) => Number(v).toLocaleString('pt-BR')
  return undefined
}
