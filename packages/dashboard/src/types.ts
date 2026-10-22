import type { VNodeChild } from 'vue'

/**
 * 数据看板组件类型。
 *
 * 所有 option 类型刻意用 `Record<string, any>` —— 与 `uiProps` 同一策略：
 * ECharts 大版本升级不该变成我们的 breaking change。
 */

export type TrendDirection = 'up' | 'down' | 'flat'

/** 变化率的语义：up 是好是坏，取决于指标本身 */
export type ChangeTone = 'auto' | 'positive' | 'negative' | 'neutral'

export interface StatCardProps {
  /** 指标名称 */
  title: string
  /** 主数值。数字会自动加千分位 */
  value: number | string
  /** 数值前缀，如 ¥ */
  prefix?: string
  /** 数值后缀，如 % / 单 */
  suffix?: string
  /** 小数位，默认 0 */
  precision?: number
  /** 变化率。传 null 不显示 */
  change?: number | null
  /** 变化率的语义方向。默认 auto：正数视为正向 */
  changeTone?: ChangeTone
  /** 变化率旁的单位说明，如「较上月」 */
  changeLabel?: string
  /** 迷你趋势图数据。传空数组不显示 */
  trend?: number[]
  /** 加载态 */
  loading?: boolean
  /** 是否可点击（hover 有反馈） */
  clickable?: boolean
}

export interface StatCardSlots {
  /** 覆盖右上角图标 */
  icon?: () => VNodeChild
  /** 覆盖底部区域 */
  footer?: () => VNodeChild
}

export interface StatGroupProps {
  /** 列数。数字固定，对象形式按断点 */
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  /** 卡片间距，默认 md */
  gap?: 'sm' | 'md' | 'lg'
}

export interface ChartCardProps {
  /** 卡片标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 图表高度，默认取 --fbk-chart-height */
  height?: string | number
  /** 加载态 */
  loading?: boolean
  /** 空态 */
  empty?: boolean
  /** 空态文案 */
  emptyText?: string
}

export interface ChartCardSlots {
  /** 标题右侧的额外内容（如时间范围切换） */
  extra?: () => VNodeChild
  /** 图表内容 */
  default?: () => VNodeChild
}

export interface TrendChartProps extends ChartCardProps {
  /** X 轴类目 */
  categories: string[]
  /** 系列。每项是一组数据 */
  series: TrendSeries[]
  /** 是否显示面积填充，默认 true */
  area?: boolean
  /** 是否平滑曲线，默认 true */
  smooth?: boolean
  /** Y 轴是否从 0 开始，默认 true */
  startFromZero?: boolean
}

export interface TrendSeries {
  name: string
  data: number[]
  /** 不传则按色板顺序取色 */
  color?: string
}

export interface BarChartProps extends ChartCardProps {
  categories: string[]
  series: TrendSeries[]
  /** 方向，默认 vertical（柱状）；horizontal 为条形 */
  direction?: 'vertical' | 'horizontal'
  /** 是否堆叠 */
  stacked?: boolean
}

export interface PieChartProps extends ChartCardProps {
  data: PieDatum[]
  /** 环形图内径占比，0 为实心饼图，默认 0.62 */
  innerRadius?: number
  /** 中心主文案（仅环形图） */
  centerLabel?: string
  /** 中心数值 */
  centerValue?: string | number
}

export interface PieDatum {
  name: string
  value: number
  color?: string
}

export interface RankListProps {
  data: RankItem[]
  /** 最大值，用于计算进度条宽度。不传取数据最大值 */
  max?: number
  /** 数值格式化，默认百分比 */
  formatter?: (value: number) => string
  /** 最大显示条数 */
  limit?: number
}

export interface RankItem {
  name: string
  value: number
  /** 自定义颜色，不传按排名取色板 */
  color?: string
}
