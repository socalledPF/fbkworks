<script setup lang="ts">
import { useAttrs } from 'vue'
import type { ChartCardProps } from './types'

/**
 * 图表卡片外壳。
 *
 * 所有图表组件（TrendChart / BarChart / PieChart）共用它，
 * 保证标题区高度、内边距、空态表现完全一致 —— 否则并排摆放时
 * 标题基线会错位。
 */
defineOptions({ name: 'FbkChartCard', inheritAttrs: false })

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

withDefaults(defineProps<ChartCardProps>(), {
  title: undefined,
  subtitle: undefined,
  height: undefined,
  loading: false,
  empty: false,
  emptyText: '暂无数据',
})
</script>

<template>
  <section class="fbk-chart-card" v-bind="attrs">
    <header v-if="title || $slots.extra" class="fbk-chart-card__header">
      <div class="fbk-chart-card__heading">
        <h3 v-if="title" class="fbk-chart-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="fbk-chart-card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.extra" class="fbk-chart-card__extra">
        <slot name="extra" />
      </div>
    </header>

    <div class="fbk-chart-card__body">
      <slot />
    </div>
  </section>
</template>
