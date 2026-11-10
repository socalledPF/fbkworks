<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import {
  FbkChart,
  CHART_AXIS_LABEL,
  CHART_AXIS_LINE,
  CHART_SPLIT_LINE,
  seriesColor,
} from '@fbkworks/chart-core'
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
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()
/* 把 FbkChart 的错误转出去。FbkChart 只 emit('error')、不 console，
   而大屏这四个组件此前**一个都没监听** —— 配置写错时图表静默保留上一帧或空白，
   生产环境没有任何信号。dashboard 的三个组件本来就有这条转发，这里补齐。 */
const emit = defineEmits<{ error: [error: unknown] }>()

const option = computed(() => ({
  grid: { left: 8, right: 16, top: props.series.length > 1 ? 44 : 20, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  legend:
    props.series.length > 1
      ? { top: 0, right: 0, itemGap: 20, icon: 'roundRect', textStyle: { fontSize: 14 } }
      : undefined,
  xAxis: {
    type: 'category',
    data: props.categories,
    boundaryGap: false,
    axisLine: { lineStyle: { color: CHART_AXIS_LINE, width: 1 } },
    axisLabel: { color: CHART_AXIS_LABEL, fontSize: 14 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    min: 0,
    axisLine: { show: false },
    axisLabel: { color: CHART_AXIS_LABEL, fontSize: 14 },
    splitLine: { lineStyle: { color: CHART_SPLIT_LINE, type: 'dashed' } },
  },
  series: props.series.map((s, i) => {
    const color = seriesColor(i, s.color)
    return {
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: props.smooth,
      symbol: 'circle',
      symbolSize: 7,
      showSymbol: true,
      itemStyle: { color },
      lineStyle: {
        width: 3,
        // 发光：大屏的视觉语言，浅色主题下不会用到这个组件
        shadowColor: color,
        shadowBlur: 10,
      },
      areaStyle: props.area
        ? {
            opacity: 0.18,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color },
                { offset: 1, color: 'transparent' },
              ],
            },
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
      @error="(e: unknown) => emit('error', e)"
      :option="option"
      :height="height"
      :loading="loading"
      :is-empty="empty || !categories.length"
      empty-text="暂无数据"
    />
  </div>
</template>
