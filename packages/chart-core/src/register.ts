import * as echarts from 'echarts/core'
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from 'echarts/charts'
import {
  DataZoomComponent,
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { warnOnce } from '@fbkworks/shared'
import type { FbkChartType, RegisterChartsOptions } from './types'

/**
 * ECharts 按需注册。
 *
 * 为什么需要：ECharts 全量约 1MB（gzip ~330KB）。大屏能接受，
 * 但嵌入后台的数据看板不该为此付出代价。
 *
 * **为什么用同步静态导入而不是动态 import**：
 * 图表必须在组件渲染前完成注册，异步注册会导致首屏空白一帧。
 * 静态导入让打包器能静态分析、只打包用到的模块。
 *
 * 代价：即使业务方只用折线图，未使用的图表模块也在包里。
 * 要极致瘦身应改用 `echarts/core` 手动注册（文档里说明）。
 */

const CHART_MAP = {
  line: LineChart,
  bar: BarChart,
  pie: PieChart,
  gauge: GaugeChart,
  scatter: ScatterChart,
  radar: RadarChart,
  funnel: FunnelChart,
} as const

const COMPONENT_MAP = {
  grid: GridComponent,
  tooltip: TooltipComponent,
  legend: LegendComponent,
  title: TitleComponent,
  dataset: DatasetComponent,
  transform: TransformComponent,
  markLine: MarkLineComponent,
  markPoint: MarkPointComponent,
  graphic: GraphicComponent,
  visualMap: VisualMapComponent,
  dataZoom: DataZoomComponent,
} as const

const DEFAULT_CHARTS = ['line', 'bar', 'pie', 'gauge'] as const
const DEFAULT_COMPONENTS = [
  'grid',
  'tooltip',
  'legend',
  'title',
  'dataset',
  'markLine',
  'markPoint',
  'graphic',
] as const

let registered = false
const doneCharts = new Set<string>()
const doneComponents = new Set<string>()

/**
 * 注册图表能力。可多次调用，只注册尚未注册的部分。
 *
 * ```ts
 * // 默认：折线 / 柱状 / 饼 / 仪表盘 + 常用组件
 * registerFbkCharts()
 *
 * // 按需：只要折线
 * registerFbkCharts({ charts: ['line'], components: ['grid', 'tooltip'] })
 * ```
 */
export function registerFbkCharts(options: RegisterChartsOptions = {}): void {
  const charts = (options.charts ?? DEFAULT_CHARTS) as FbkChartType[]
  const components = options.components ?? (DEFAULT_COMPONENTS as unknown as string[])

  const pendingCharts = charts.filter((c) => !doneCharts.has(c))
  const pendingComponents = components.filter((c) => !doneComponents.has(c))

  if (!pendingCharts.length && !pendingComponents.length) return

  // FbkChartType / FbkChartComponent 比映射表宽（'map' / 'geo' / 'toolbox' 尚无实现）。
  // 类型能过、ECharts 侧却没东西可用 —— 只把真正注册成功的项标记为完成，
  // 否则未登记项会被当成"已注册"，既不重试也没有任何线索。
  const resolvedCharts = pendingCharts.filter((c) => {
    if ((CHART_MAP as Record<string, any>)[c]) return true
    warnOnce(
      `chart:unresolved:chart:${c}`,
      `图表类型 "${c}" 尚未在 @fbkworks/chart-core 中实现，已跳过注册（该类型的图表会空白）。`,
    )
    return false
  })
  const resolvedComponents = pendingComponents.filter((c) => {
    if ((COMPONENT_MAP as Record<string, any>)[c]) return true
    warnOnce(
      `chart:unresolved:component:${c}`,
      `图表组件 "${c}" 尚未在 @fbkworks/chart-core 中实现，已跳过注册（依赖它的图表会空白）。`,
    )
    return false
  })

  if (!resolvedCharts.length && !resolvedComponents.length) return

  echarts.use([
    ...resolvedCharts.map((c) => (CHART_MAP as Record<string, any>)[c]),
    ...resolvedComponents.map((c) => (COMPONENT_MAP as Record<string, any>)[c]),
    CanvasRenderer,
  ])

  resolvedCharts.forEach((c) => doneCharts.add(c))
  resolvedComponents.forEach((c) => doneComponents.add(c))
  registered = true
}

/** 是否已完成注册（测试与调试用） */
export function isFbkChartsRegistered(): boolean {
  return registered
}

/** 测试用：重置注册状态。注意 echarts 内部注册表无法真正撤销 */
export function __resetChartRegistration(): void {
  registered = false
  doneCharts.clear()
  doneComponents.clear()
}
