<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { RankListProps } from './types'

/**
 * 排行榜。
 *
 * 用 DOM + CSS 而不是图表：条形图能画，但排行榜需要"名次 + 名称 + 数值"
 * 三列对齐，用图表实现反而要手工算布局。DOM 天然满足可访问性与响应式。
 */
defineOptions({ name: 'FbkRankList', inheritAttrs: false })

const props = withDefaults(defineProps<RankListProps>(), {
  max: undefined,
  formatter: undefined,
  limit: undefined,
})

/* inheritAttrs: false 时必须手动转发 attrs，否则调用方的 class/style 会丢失 */
const attrs = useAttrs()

const rows = computed(() => {
  const list = props.limit ? props.data.slice(0, props.limit) : props.data
  const maxValue = props.max ?? Math.max(...list.map((d) => d.value), 0)
  return list.map((item, index) => ({
    ...item,
    rank: index + 1,
    // 宽度百分比。maxValue 为 0 时全部为 0，避免除零得到 NaN
    percent: maxValue > 0 ? Math.max((item.value / maxValue) * 100, 2) : 0,
    display: props.formatter ? props.formatter(item.value) : String(item.value),
  }))
})

/** 前三名用色板前三位，其余用中性色 —— 超过三个高亮等于没有高亮 */
function barColor(rank: number) {
  return rank <= 3 ? `var(--fbk-chart-${rank})` : 'var(--fbk-color-border)'
}
</script>

<template>
  <ol class="fbk-rank-list" v-bind="attrs">
    <li v-for="row in rows" :key="row.name" class="fbk-rank-list__row" :data-rank="row.rank">
      <span class="fbk-rank-list__rank" :class="{ 'is-top': row.rank <= 3 }">{{ row.rank }}</span>
      <span class="fbk-rank-list__name" :title="row.name">{{ row.name }}</span>
      <span class="fbk-rank-list__bar">
        <span
          class="fbk-rank-list__bar-fill"
          :style="{ width: `${row.percent}%`, background: row.color ?? barColor(row.rank) }"
        />
      </span>
      <span class="fbk-rank-list__value">{{ row.display }}</span>
    </li>
  </ol>
</template>
