<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbkworks/chart-core'
import FbkChartCard from './ChartCard.vue'
import type { PieChartProps } from './types'

/**
 * 饼图 / 环形图。
 *
 * 默认环形（innerRadius 0.62）：环形比实心饼更容易读，
 * 而且中心可以放总计 —— 这是数据看板的高频需求。
 */
const emit = defineEmits<{ error: [error: unknown] }>()

defineOptions({ name: 'FbkPieChart', inheritAttrs: false })

const props = withDefaults(defineProps<PieChartProps>(), {
  title: undefined,
  subtitle: undefined,
  height: undefined,
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  innerRadius: 0.62,
  centerLabel: undefined,
  centerValue: undefined,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const option = computed(() => {
  const inner = Math.round(props.innerRadius * 100)
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      // 图例放右侧竖排：饼图本身要占满左侧空间
      orient: 'vertical',
      right: 0,
      top: 'middle',
      itemGap: 12,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: 'var(--fbk-chart-axis-label)' },
    },
    series: [
      {
        type: 'pie',
        // 环形图才有内径
        radius: [`${inner}%`, '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          // 分隔线用卡片底色，形成"切开的缝"效果
          borderColor: 'var(--fbk-color-bg-container)',
          borderWidth: 2,
          borderRadius: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        data: props.data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color ?? `var(--fbk-chart-${(i % 8) + 1})` },
        })),
      },
    ],
  }
})

const showCenter = computed(() => props.innerRadius > 0 && (props.centerValue !== undefined || props.centerLabel))
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
    <div class="fbk-pie-chart">
      <FbkChart
      @error="(e: unknown) => emit('error', e)"
        :option="option"
        :height="height"
        :loading="loading"
        :is-empty="empty || !data.length"
        :empty-text="emptyText"
      />
      <!-- 中心文案叠在图表上，而不是用 ECharts 的 graphic ——
           用 DOM 才能跟随主题变量与字体设置 -->
      <div v-if="showCenter" class="fbk-pie-chart__center">
        <span v-if="centerValue !== undefined" class="fbk-pie-chart__value">{{ centerValue }}</span>
        <span v-if="centerLabel" class="fbk-pie-chart__label">{{ centerLabel }}</span>
      </div>
    </div>
  </FbkChartCard>
</template>
