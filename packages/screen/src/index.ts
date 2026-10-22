/**
 * 可视化大屏组件。Barrel 只做 re-export，不 import CSS。
 * 样式按需导入：`@fbk/screen/style.css`
 */
export { default as FbkScreenPage } from './ScreenPage.vue'
export { default as FbkScreenHeader } from './ScreenHeader.vue'
export { default as FbkScreenPanel } from './ScreenPanel.vue'
export { default as FbkScreenGrid } from './ScreenGrid.vue'
export { default as FbkScreenNumber } from './ScreenNumber.vue'
export { default as FbkScreenScrollList } from './ScreenScrollList.vue'
export { default as FbkScreenLineChart } from './ScreenLineChart.vue'
export { default as FbkScreenBarChart } from './ScreenBarChart.vue'
export { default as FbkScreenPieChart } from './ScreenPieChart.vue'
export { default as FbkScreenGaugeChart } from './ScreenGaugeChart.vue'

export type {
  ScreenBarChartProps,
  ScreenChartProps,
  ScreenGaugeChartProps,
  ScreenGridProps,
  ScreenHeaderProps,
  ScreenLineChartProps,
  ScreenNumberProps,
  ScreenPageProps,
  ScreenPanelProps,
  ScreenPanelSlots,
  ScreenPieChartProps,
  ScreenScrollItem,
  ScreenScrollListProps,
} from './types'
