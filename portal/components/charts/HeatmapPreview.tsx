'use client'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { ChartMetadata } from '@/lib/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const DAYS  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HOURS = ['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h']

// Padrão de movimento realista para posto de combustível
// [hora][dia]: Dom=0, Seg=1 ... Sáb=6
const PATTERN: number[][] = [
  [ 15,  20,  18,  22,  20,  25,  30], // 00h — madrugada baixa
  [  8,  10,   8,  10,  10,  15,  20], // 03h — mínimo
  [ 10,  38,  32,  34,  36,  40,  18], // 06h — rush manhã semana
  [ 28,  68,  62,  65,  70,  75,  42], // 09h — pico manhã
  [ 42,  58,  54,  56,  60,  62,  58], // 12h — almoço
  [ 48,  72,  68,  70,  75,  82,  72], // 15h — tarde
  [ 52,  62,  60,  64,  70,  95,  88], // 18h — pico saída sex/sáb
  [ 38,  44,  40,  42,  48,  75,  68], // 21h — noite
]

export function HeatmapPreview({ metadata }: { metadata: ChartMetadata }) {
  const xLabel = metadata.axes.x.label      || 'Horário'
  const yLabel = metadata.axes.y[0]?.label  || 'Dia'
  const valLabel = metadata.axes.y[1]?.label || metadata.axes.y[0]?.label || 'Volume'

  const heatData = useMemo(() => {
    const arr: [number, number, number][] = []
    PATTERN.forEach((row, hi) =>
      row.forEach((v, di) => arr.push([hi, di, v]))
    )
    return arr
  }, [])

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (p: { data: [number, number, number] }) =>
        `<b>${DAYS[p.data[1]]}</b> · ${HOURS[p.data[0]]}<br/>${valLabel}: <b>${p.data[2]}</b>`,
    },
    grid: { top: 8, right: 12, bottom: 56, left: 36 },
    xAxis: {
      type: 'category',
      data: HOURS,
      splitArea: { show: false },
      axisLabel: { color: '#555', fontSize: 10 },
      axisLine: { lineStyle: { color: '#222' } },
      axisTick: { show: false },
      name: xLabel,
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: '#444', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: DAYS,
      splitArea: { show: false },
      axisLabel: { color: '#555', fontSize: 10 },
      axisLine: { lineStyle: { color: '#222' } },
      axisTick: { show: false },
      name: yLabel,
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: '#444', fontSize: 10 },
    },
    visualMap: {
      min: 0, max: 100,
      calculable: false,
      show: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 10,
      itemHeight: 90,
      text: ['100', '0'],
      textStyle: { color: '#555', fontSize: 9 },
      inRange: { color: ['#0d1a12', '#004d1e', '#009c3b', '#00d45a'] },
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: {
        show: true,
        fontSize: 9,
        color: 'rgba(255,255,255,0.7)',
        formatter: (p: { data: [number, number, number] }) =>
          p.data[2] >= 30 ? String(p.data[2]) : '',
      },
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,156,59,0.4)' },
      },
      itemStyle: {
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: '#0a0a0a',
      },
    }],
  }), [heatData, xLabel, yLabel, valLabel])

  return (
    <div className="h-full flex flex-col bg-[#111]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/8 flex-shrink-0">
        <span className="text-white/40 text-xs">Preview — padrão de movimento simulado</span>
        <span className="text-white/30 text-xs">Heatmap · {DAYS.length}d × {HOURS.length}h</span>
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
