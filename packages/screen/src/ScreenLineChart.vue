<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbk/chart-core'
import type { ScreenLineChartProps } from './types'

/**
 * 大屏折线图。
 *
 * 与 dashboard 的 TrendChart 的区别（不是简单复用）：
 *   · 线更粗（3px vs 2px）、发光更强 —— 远距离观看需要更重的笔触
 *   · 坐标轴文字更大（14px vs 12px）
 *   · 默认显示所有数据点符号（大屏不 hover，看不到 tooltip）
 */
defineOptions({ name: 'FbkScreenLineChart', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenLineChartProps>(), {
  title: undefined,
  height: undefined,
  loading: false,
  empty: false,
  smooth: true,
  area: true,
  threshold: undefined,
  thresholdLabel: '阈值',
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const option = computed(() => ({
  grid: { left: 8, right: 16, top: props.series.length > 1 ? 44 : 20, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  legend:
    props.series.length > 1
      ? { top: 0, right: 0, itemGap: 16, icon: 'roundRect', textStyle: { fontSize: 11, color: '#8b95a1' } }
      : undefined,
  xAxis: {
    type: 'category',
    data: props.categories,
    boundaryGap: false,
    axisLine: { lineStyle: { color: '#2a313a', width: 1 } },
    axisLabel: { color: '#6f7885', fontSize: 11 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    min: 0,
    axisLine: { show: false },
    axisLabel: { color: '#6f7885', fontSize: 11 },
    splitLine: { lineStyle: { color: '#222831', type: 'solid' } },
  },
  series: props.series.map((s, i) => {
    const color = s.color ?? `var(--fbk-chart-${(i % 8) + 1})`
    return {
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: props.smooth,
      symbol: 'circle',
      symbolSize: 4,
      // 监控图数据点密集，只在拐点显示符号会显得杂乱，默认全隐藏
      showSymbol: false,
      itemStyle: { color },
      lineStyle: {
        // 2px 而不是 3px：监控图强调读数准确，不是视觉冲击
        width: 2,
      },
      areaStyle: props.area ? { opacity: 0.1 } : undefined,
      /* 限值线：监控图表的核心元素。
         没有它，看图表的人不知道「多少算异常」——
         只能凭感觉，而凭感觉判断不出 87% 是不是危险。 */
      markLine:
        props.threshold !== undefined
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#c05a4a', type: 'dashed', width: 1 },
              label: {
                formatter: `${props.thresholdLabel} ${props.threshold}`,
                position: 'insideEndTop',
                color: '#c05a4a',
                fontSize: 11,
              },
              data: [{ yAxis: props.threshold }],
            }
          : undefined,
    }
  }),
}))
</script>

<template>
  <div class="fbk-screen-chart" v-bind="attrs">
    <div v-if="title" class="fbk-screen-chart__title">{{ title }}</div>
    <FbkChart
      :option="option"
      :height="height"
      :loading="loading"
      :is-empty="empty || !categories.length"
      empty-text="暂无数据"
    />
  </div>
</template>
