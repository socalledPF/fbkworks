<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbk/chart-core'
import type { ScreenBarChartProps } from './types'

/**
 * 大屏柱状图。
 * 与 dashboard 版本的区别：柱更宽、带发光、轴文字更大。
 */
defineOptions({ name: 'FbkScreenBarChart', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenBarChartProps>(), {
  title: undefined,
  height: undefined,
  loading: false,
  empty: false,
  stacked: false,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const option = computed(() => ({
  grid: { left: 8, right: 16, top: props.series.length > 1 ? 44 : 20, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend:
    props.series.length > 1
      ? { top: 0, right: 0, itemGap: 20, icon: 'roundRect', textStyle: { fontSize: 14 } }
      : undefined,
  xAxis: {
    type: 'category',
    data: props.categories,
    axisLine: { lineStyle: { color: 'var(--fbk-chart-axis-line)' } },
    axisLabel: { color: 'var(--fbk-chart-axis-label)', fontSize: 14 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: 'var(--fbk-chart-axis-label)', fontSize: 14 },
    splitLine: { lineStyle: { color: 'var(--fbk-chart-split-line)', type: 'dashed' } },
  },
  series: props.series.map((s, i) => {
    const color = s.color ?? `var(--fbk-chart-${(i % 8) + 1})`
    return {
      name: s.name,
      type: 'bar',
      data: s.data,
      stack: props.stacked ? 'total' : undefined,
      barMaxWidth: 28,
      itemStyle: {
        color,
        borderRadius: props.stacked
          ? i === props.series.length - 1
            ? [4, 4, 0, 0]
            : 0
          : [4, 4, 0, 0],
        shadowColor: color,
        shadowBlur: 8,
      },
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
