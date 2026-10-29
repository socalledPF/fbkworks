<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbkworks/chart-core'
import FbkChartCard from './ChartCard.vue'
import type { BarChartProps } from './types'

/**
 * 柱状 / 条形图。
 *
 * 支持分组与堆叠。横向条形图在类目名较长时更可读（标签不用旋转）。
 */
const emit = defineEmits<{ error: [error: unknown] }>()

defineOptions({ name: 'FbkBarChart', inheritAttrs: false })

const props = withDefaults(defineProps<BarChartProps>(), {
  title: undefined,
  subtitle: undefined,
  height: undefined,
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  direction: 'vertical',
  stacked: false,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const isHorizontal = computed(() => props.direction === 'horizontal')

const option = computed(() => {
  /* 横向时类目轴与数值轴互换。
     注意 xAxis/yAxis 的配置也要跟着换 —— 只换 series 的 type
     会导致轴标签还是竖向排列，看起来像坏了。 */
  const categoryAxis = {
    type: 'category',
    data: props.categories,
    axisLine: { lineStyle: { color: 'var(--fbk-chart-axis-line)' } },
    axisLabel: {
      color: 'var(--fbk-chart-axis-label)',
      // 横向条形图类目名较长，超长省略而不是旋转
      ...(isHorizontal.value ? { width: 90, overflow: 'truncate' } : {}),
    },
    axisTick: { show: false },
  }
  const valueAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: 'var(--fbk-chart-axis-label)' },
    splitLine: { lineStyle: { color: 'var(--fbk-chart-split-line)', type: 'dashed' } },
  }

  return {
    grid: { left: 8, right: 16, top: props.series.length > 1 ? 40 : 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend:
      props.series.length > 1
        ? { top: 0, right: 0, itemGap: 16, icon: 'roundRect' }
        : undefined,
    xAxis: isHorizontal.value ? valueAxis : categoryAxis,
    yAxis: isHorizontal.value ? categoryAxis : valueAxis,
    series: props.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      stack: props.stacked ? 'total' : undefined,
      itemStyle: {
        color: s.color ?? `var(--fbk-chart-${(i % 8) + 1})`,
        /* 堆叠时只有最外段该有圆角，全加会在接缝处出现"双圆角" */
        borderRadius: props.stacked
          ? i === props.series.length - 1
            ? isHorizontal.value
              ? [0, 4, 4, 0]
              : [4, 4, 0, 0]
            : 0
          : isHorizontal.value
            ? [0, 4, 4, 0]
            : [4, 4, 0, 0],
      },
      barMaxWidth: 32,
    })),
  }
})
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
