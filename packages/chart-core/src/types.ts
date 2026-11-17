import type { EChartsOption } from 'echarts'

/**
 * 图表核心类型。
 *
 * 注意：`EChartsOption` **只用于内部**，不进入任何公开 props 的类型签名。
 * 公开 API 一律用 `Record<string, any>` —— 与 `uiProps` 同一策略：
 * ECharts 大版本升级不该变成我们的 breaking change。
 * 这条由 scripts/check-type-surface.mjs 检查。
 */

/** 对外暴露的 option 类型。刻意放宽，避免把 echarts 的类型绑进公开契约 */
export type FbkChartOption = Record<string, any>

/** 图表类型（按需注册用） */
/**
 * 可用的图表类型。
 *
 * 这里**必须**与 register.ts 的 CHART_MAP 一一对应 —— 类型比映射表宽的那种情况
 * （原来多一个 'map'）意味着「类型上允许、注册时被静默丢弃」：
 * echarts 的 map 还需要业务方提供 GeoJSON（registerMap），本库没有这个入口，
 * 与其留一个假装支持的联合成员，不如删掉。
 */
export type FbkChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'scatter' | 'radar' | 'funnel'

/** ECharts 组件（按需注册用） */
export type FbkChartComponent =
  | 'grid'
  | 'tooltip'
  | 'legend'
  | 'title'
  | 'dataset'
  | 'transform'
  | 'markLine'
  | 'markPoint'
  | 'graphic'
  | 'geo'
  | 'visualMap'
  | 'dataZoom'
  | 'toolbox'

export interface RegisterChartsOptions {
  /** 要注册的图表类型。不传 = 注册全部 */
  charts?: FbkChartType[]
  /** 要注册的组件。不传 = 注册全部 */
  components?: FbkChartComponent[]
}

/** 图表主题：从 CSS 变量读出来的颜色集合 */
export interface FbkChartTheme {
  /** 分类色板，8 色 */
  palette: string[]
  axisLine: string
  axisLabel: string
  splitLine: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  areaOpacity: number
  textColor: string
  textSecondary: string
  bgContainer: string
  fontFamily: string
  fontSize: number
  /** 由 ECharts 内部使用的完整 theme 对象（不对外暴露结构） */
  _echartsTheme: Record<string, any>
}

/** 内部使用：把 option 收紧成 ECharts 能接受的形式 */
export type InternalChartOption = EChartsOption
