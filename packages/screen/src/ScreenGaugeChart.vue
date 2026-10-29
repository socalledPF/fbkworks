<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbkworks/chart-core'
import type { ScreenGaugeChartProps } from './types'

/**
 * 仪表盘。大屏常见的"完成率 / 健康度"类指标。
 *
 * 用 ECharts gauge 而不是自己画 SVG：
 * 刻度、指针、弧线的数学计算容易出错，交给图表库更稳。
 */
defineOptions({ name: 'FbkScreenGaugeChart', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenGaugeChartProps>(), {
  title: undefined,
  height: undefined,
  loading: false,
  empty: false,
  max: 100,
  unit: '%',
  label: undefined,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const option = computed(() => ({
  series: [
    {
      type: 'gauge',
      min: 0,
      max: props.max,
      radius: '88%',
      center: ['50%', '58%'],
      progress: {
        show: true,
        width: 10,
        itemStyle: {
          color: 'var(--fbk-chart-1)',
          shadowColor: 'var(--fbk-chart-1)',
          shadowBlur: 10,
        },
      },
      axisLine: {
        lineStyle: {
          width: 10,
          color: [[1, 'var(--fbk-chart-split-line)']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: 'var(--fbk-chart-axis-label)',
        fontSize: 11,
        // 往内收，避免与 detail/title 抢位置
        distance: 6,
      },
      pointer: {
        width: 4,
        length: '62%',
        itemStyle: { color: 'var(--fbk-chart-1)' },
      },
      anchor: {
        show: true,
        size: 10,
        itemStyle: { color: 'var(--fbk-chart-1)' },
      },
      /* 标题与数值的纵向位置必须错开：
         detail 在中心偏上，title 在它下方。
         早期 detail=44% / title=78%，两者与刻度标签（distance 14）
         挤在一起，实测「转化率」与刻度重叠。 */
      title: {
        show: Boolean(props.label),
        offsetCenter: [0, '72%'],
        color: 'var(--fbk-chart-axis-label)',
        fontSize: 13,
      },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, '38%'],
        fontSize: 24,
        fontWeight: 600,
        color: 'var(--fbk-color-text)',
        formatter: `{value}${props.unit}`,
      },
      data: [{ value: props.value, name: props.label ?? '' }],
    },
  ],
}))
</script>

<template>
  <div class="fbk-screen-chart" v-bind="attrs">
    <div v-if="title" class="fbk-screen-chart__title">{{ title }}</div>
    <FbkChart
      :option="option"
      :height="height"
      :loading="loading"
      :is-empty="empty"
      empty-text="暂无数据"
    />
  </div>
</template>
