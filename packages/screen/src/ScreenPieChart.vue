<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart, CHART_AXIS_LABEL, seriesColor } from '@fbkworks/chart-core'
import type { ScreenPieChartProps } from './types'

/**
 * 大屏环形图。
 * 默认带中心数值，图例竖排右侧，与大屏的横向信息流一致。
 */
defineOptions({ name: 'FbkScreenPieChart', inheritAttrs: false })

const props = withDefaults(defineProps<ScreenPieChartProps>(), {
  title: undefined,
  height: undefined,
  loading: false,
  empty: false,
  innerRadius: 0.6,
  centerValue: undefined,
  centerLabel: undefined,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const option = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: {
    orient: 'vertical',
    right: 0,
    top: 'middle',
    itemGap: 14,
    icon: 'circle',
    itemWidth: 9,
    itemHeight: 9,
    textStyle: { color: CHART_AXIS_LABEL, fontSize: 14 },
  },
  series: [
    {
      type: 'pie',
      radius: [`${Math.round(props.innerRadius * 100)}%`, '70%'],
      center: ['36%', '50%'],
      itemStyle: {
        borderColor: 'transparent',
        borderWidth: 2,
        borderRadius: 3,
      },
      label: { show: false },
      labelLine: { show: false },
      emphasis: {
        // 大屏常做自动轮播高亮，这里给出放大反馈
        scaleSize: 6,
      },
      data: props.data.map((d, i) => ({
        name: d.name,
        value: d.value,
        itemStyle: { color: seriesColor(i, d.color) },
      })),
    },
  ],
}))

const showCenter = computed(() => props.innerRadius > 0 && (props.centerValue !== undefined || props.centerLabel))
</script>

<template>
  <div class="fbk-screen-chart" v-bind="attrs">
    <div v-if="title" class="fbk-screen-chart__title">{{ title }}</div>
    <div class="fbk-screen-chart__pie">
      <FbkChart
        :option="option"
        :height="height"
        :loading="loading"
        :is-empty="empty || !data.length"
        empty-text="暂无数据"
      />
      <div v-if="showCenter" class="fbk-screen-chart__center">
        <span v-if="centerValue !== undefined" class="fbk-screen-chart__center-value">
          {{ centerValue }}
        </span>
        <span v-if="centerLabel" class="fbk-screen-chart__center-label">{{ centerLabel }}</span>
      </div>
    </div>
  </div>
</template>
