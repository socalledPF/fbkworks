<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import {
  FbkChart,
  CHART_AXIS_LABEL,
  CHART_AXIS_LINE,
  CHART_SPLIT_LINE,
  barRadius,
  seriesColor,
  stackedBarRadius,
} from '@fbkworks/chart-core'
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
/* 把 FbkChart 的错误转出去。FbkChart 只 emit('error')、不 console，
   而大屏这四个组件此前**一个都没监听** —— 配置写错时图表静默保留上一帧或空白，
   生产环境没有任何信号。dashboard 的三个组件本来就有这条转发，这里补齐。 */
const emit = defineEmits<{ error: [error: unknown] }>()

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
    axisLine: { lineStyle: { color: CHART_AXIS_LINE } },
    axisLabel: { color: CHART_AXIS_LABEL, fontSize: 14 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: CHART_AXIS_LABEL, fontSize: 14 },
    splitLine: { lineStyle: { color: CHART_SPLIT_LINE, type: 'dashed' } },
  },
  series: props.series.map((s, i) => {
    const color = seriesColor(i, s.color)
    return {
      name: s.name,
      type: 'bar',
      data: s.data,
      stack: props.stacked ? 'total' : undefined,
      barMaxWidth: 28,
      itemStyle: {
        color,
        borderRadius: props.stacked
          ? stackedBarRadius(i, props.series.length, false)
          : barRadius(false),
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
      @error="(e: unknown) => emit('error', e)"
      :option="option"
      :height="height"
      :loading="loading"
      :is-empty="empty || !categories.length"
      empty-text="暂无数据"
    />
  </div>
</template>
