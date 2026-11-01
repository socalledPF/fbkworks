export { default as FbkChart } from './FbkChart.vue'
export { registerFbkCharts, isFbkChartsRegistered } from './register'
export { resolveChartTheme, chartColor } from './theme'
export { resolveCssValue, resolveOptionVars, isCssVar } from './color'
export {
  CHART_AXIS_LABEL,
  CHART_AXIS_LINE,
  CHART_SPLIT_LINE,
  FBK_CHART_PALETTE_SIZE,
  barRadius,
  seriesColor,
  stackedBarRadius,
} from './option'
export type {
  FbkChartComponent,
  FbkChartOption,
  FbkChartTheme,
  FbkChartType,
  RegisterChartsOptions,
} from './types'
