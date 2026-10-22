/**
 * 数据看板组件。Barrel 只做 re-export，不 import CSS —— 保证 tree-shaking。
 * 样式按需导入：`@fbk/dashboard/style.css`
 */
export { default as FbkStatCard } from './StatCard.vue'
export { default as FbkStatGroup } from './StatGroup.vue'
export { default as FbkChartCard } from './ChartCard.vue'
export { default as FbkTrendChart } from './TrendChart.vue'
export { default as FbkBarChart } from './BarChart.vue'
export { default as FbkPieChart } from './PieChart.vue'
export { default as FbkRankList } from './RankList.vue'

export type {
  BarChartProps,
  ChangeTone,
  ChartCardProps,
  ChartCardSlots,
  PieChartProps,
  PieDatum,
  RankItem,
  RankListProps,
  StatCardProps,
  StatCardSlots,
  StatGroupProps,
  TrendChartProps,
  TrendDirection,
  TrendSeries,
} from './types'
