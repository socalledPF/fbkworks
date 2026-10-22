export { default as FbkChart } from './FbkChart.vue'
export { registerFbkCharts, isFbkChartsRegistered } from './register'
export { resolveChartTheme, chartColor } from './theme'
export { resolveCssValue, resolveOptionVars, isCssVar } from './color'
export type {
  FbkChartComponent,
  FbkChartOption,
  FbkChartTheme,
  FbkChartType,
  RegisterChartsOptions,
} from './types'
