<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import {
  FbkChart,
  CHART_AXIS_LABEL,
  CHART_AXIS_LINE,
  CHART_SPLIT_LINE,
  FBK_CHART_PALETTE_SIZE,
  chartColor,
  seriesColor,
} from '@fbkworks/chart-core'
import FbkChartCard from './ChartCard.vue'
import type { TrendChartProps } from './types'

/**
 * 折线 / 面积趋势图。
 *
 * 默认带面积填充：单系列趋势图里，填充比纯线条更容易读出"量"的感觉。
 * 多系列时填充会互相遮挡，所以 `area` 默认按系列数自动关闭。
 */
const emit = defineEmits<{ error: [error: unknown] }>()

defineOptions({ name: 'FbkTrendChart', inheritAttrs: false })

const props = withDefaults(defineProps<TrendChartProps>(), {
  title: undefined,
  subtitle: undefined,
  height: undefined,
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  area: undefined,
  smooth: true,
  startFromZero: true,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

/** 未显式指定 area 时，单系列开、多系列关 */
const useArea = computed(() => props.area ?? props.series.length <= 1)

const option = computed(() => ({
  grid: {
    // 右侧留白给最后一项的标签，否则会被裁掉
    left: 8,
    right: 16,
    top: props.series.length > 1 ? 40 : 16,
    bottom: 8,
    containLabel: true,
  },
  tooltip: { trigger: 'axis' },
  legend:
    props.series.length > 1
      ? { top: 0, right: 0, itemGap: 16, icon: 'roundRect' }
      : undefined,
  xAxis: {
    type: 'category',
    data: props.categories,
    boundaryGap: false,
    axisLine: { lineStyle: { color: CHART_AXIS_LINE } },
    axisLabel: { color: CHART_AXIS_LABEL },
  },
  yAxis: {
    type: 'value',
    // 不从 0 开始会夸大波动，趋势图默认必须从 0 起
    min: props.startFromZero ? 0 : undefined,
    axisLine: { show: false },
    axisLabel: { color: CHART_AXIS_LABEL },
    splitLine: { lineStyle: { color: CHART_SPLIT_LINE, type: 'dashed' } },
  },
  series: props.series.map((s, i) => ({
    name: s.name,
    type: 'line',
    data: s.data,
    smooth: props.smooth,
    symbol: 'circle',
    symbolSize: 6,
    showSymbol: false,
    itemStyle: { color: seriesColor(i, s.color) },
    lineStyle: { width: 2 },
    areaStyle: useArea.value ? { opacity: 'var(--fbk-chart-area-opacity)' } : undefined,
  })),
}))

/** 供外部读取色板（如自定义图例） */
const palette = computed(() =>
  Array.from({ length: FBK_CHART_PALETTE_SIZE }, (_, i) => chartColor(i)),
)
defineExpose({ palette })
</script>

<template>
  <FbkChartCard v-bind="attrs"
    :title="title"
    :subtitle="subtitle"
    :loading="loading"
    :empty="empty"
    :empty-text="emptyText"
  >
    <template v-if="$slots.extra" #extra><slot name="extra" /></template>
    <FbkChart
      @error="(e: unknown) => emit('error', e)"
      :option="option"
      :height="height"
      :loading="loading"
      :is-empty="empty || !categories.length"
      :empty-text="emptyText"
    />
  </FbkChartCard>
</template>
