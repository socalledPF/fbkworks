<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { FbkChart } from '@fbk/chart-core'
import type { StatCardProps, TrendDirection } from './types'

/**
 * 核心指标卡。
 *
 * 设计要点（都来自 docs/design/2026-10-22-dashboard-screen.md）：
 *   · 数值用等宽数字 —— 否则刷新时宽度跳动，一排卡片会互相推挤
 *   · 变化率的方向与语义分开：数值涨不代表"好"（如"退款率"涨是坏事）
 *   · 迷你趋势图只画线不画轴，它是装饰不是图表
 */
defineOptions({ name: 'FbkStatCard', inheritAttrs: false })

const props = withDefaults(defineProps<StatCardProps>(), {
  prefix: undefined,
  suffix: undefined,
  precision: 0,
  change: null,
  changeTone: 'auto',
  trend: () => [],
  loading: false,
  clickable: false,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const emit = defineEmits<{
  click: []
}>()

/** 千分位 + 固定小数位。用 Intl 而不是手写正则 */
const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  const formatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: props.precision,
    maximumFractionDigits: props.precision,
  })
  return formatter.format(props.value)
})

const direction = computed<TrendDirection>(() => {
  if (props.change === null || props.change === 0) return 'flat'
  return props.change > 0 ? 'up' : 'down'
})

/**
 * 语义色调。
 *
 * `auto` 的默认规则：涨=好、跌=坏。但"退款率""错误数"这类指标相反，
 * 所以提供 changeTone 让业务方显式指定 —— 不能替他们猜。
 */
const tone = computed<'positive' | 'negative' | 'neutral'>(() => {
  if (props.changeTone !== 'auto') return props.changeTone
  if (direction.value === 'flat') return 'neutral'
  return direction.value === 'up' ? 'positive' : 'negative'
})

const changeText = computed(() => {
  if (props.change === null) return ''
  const sign = props.change > 0 ? '+' : ''
  return `${sign}${props.change.toFixed(1)}%`
})

const arrow = computed(() => {
  if (direction.value === 'up') return '↑'
  if (direction.value === 'down') return '↓'
  return '—'
})

/** 迷你趋势图：只画线，去掉所有轴与交互 */
const trendOption = computed(() => ({
  animation: false,
  grid: { left: 0, right: 0, top: 4, bottom: 0 },
  xAxis: { type: 'category', show: false, boundaryGap: false },
  yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
  series: [
    {
      type: 'line',
      data: props.trend,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1.5 },
      areaStyle: { opacity: 0.15 },
    },
  ],
}))

function onClick() {
  if (!props.clickable) return
  emit('click')
}
</script>

<template>
  <div
    class="fbk-stat-card" v-bind="attrs"
    :class="{ 'fbk-stat-card--clickable': clickable, 'fbk-stat-card--loading': loading }"
    :data-tone="tone"
    @click="onClick"
  >
    <div class="fbk-stat-card__head">
      <span class="fbk-stat-card__title">{{ title }}</span>
      <span v-if="$slots.icon" class="fbk-stat-card__icon">
        <slot name="icon" />
      </span>
    </div>

    <div class="fbk-stat-card__value">
      <span v-if="prefix" class="fbk-stat-card__affix">{{ prefix }}</span>
      <span class="fbk-stat-card__number">{{ formattedValue }}</span>
      <span v-if="suffix" class="fbk-stat-card__affix">{{ suffix }}</span>
    </div>

    <div v-if="change !== null" class="fbk-stat-card__change">
      <span class="fbk-stat-card__arrow" aria-hidden="true">{{ arrow }}</span>
      <span class="fbk-stat-card__rate">{{ changeText }}</span>
      <span v-if="changeLabel" class="fbk-stat-card__change-label">{{ changeLabel }}</span>
    </div>

    <div v-if="trend.length" class="fbk-stat-card__trend">
      <FbkChart :option="trendOption" height="32px" empty-text="" :themed="false" />
    </div>

    <div v-if="$slots.footer" class="fbk-stat-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>
