import type { VNodeChild } from 'vue'

/**
 * 可视化大屏组件类型。
 *
 * 与 dashboard 的区别：大屏是**独立全屏页面**，暗底科技蓝，
 * 按 1920×1080 设计稿等比缩放。两套视觉语言不混用。
 */

export interface ScreenPageProps {
  /** 设计稿宽度，默认 1920 */
  designWidth?: number
  /** 设计稿高度，默认 1080 */
  designHeight?: number
  /** 缩放模式：fit 等比留黑边（默认）；fill 拉伸铺满 */
  mode?: 'fit' | 'fill'
  /** 是否显示背景网格装饰，默认 true */
  grid?: boolean
  /** 是否显示顶部光晕，默认 true */
  glow?: boolean
  /** 是否显示全屏按钮（需放在 ScreenHeader 里） */
  fullscreen?: boolean
}

export interface ScreenHeaderProps {
  /** 标题 */
  title: string
  /** 是否显示实时时钟，默认 true */
  clock?: boolean
  /** 是否显示全屏按钮，默认 true */
  fullscreen?: boolean
}

export interface ScreenPanelProps {
  /** 面板标题 */
  title?: string
  /** 标题右侧额外内容 */
  extra?: string
  /** 面板高度（含标题区） */
  height?: string | number
  /** 是否显示四角装饰，默认 true */
  corners?: boolean
}

export interface ScreenPanelSlots {
  /** 标题右侧 */
  extra?: () => VNodeChild
  /** 面板内容 */
  default?: () => VNodeChild
}

export interface ScreenGridProps {
  /** 列数，默认 24（大屏常用 24 栅格） */
  columns?: number
  /** 间距，默认 md */
  gap?: 'sm' | 'md' | 'lg'
  /** 行高，用于等高布局 */
  rows?: string
}

export interface ScreenNumberProps {
  /** 数值 */
  value: number
  /** 小数位，默认 0 */
  precision?: number
  /** 前缀 */
  prefix?: string
  /** 后缀 */
  suffix?: string
  /** 动画时长（ms），默认 800 */
  duration?: number
  /** 字号档位，默认 md */
  size?: 'sm' | 'md' | 'lg'
}

export interface ScreenScrollListProps {
  /** 列表项 */
  items: ScreenScrollItem[]
  /** 每行高度，默认 44 */
  itemHeight?: number
  /** 滚动间隔（ms），默认 2500 */
  interval?: number
  /** 可见行数，默认 6 */
  visibleRows?: number
  /** 鼠标悬停是否暂停，默认 true */
  pauseOnHover?: boolean
}

export interface ScreenScrollItem {
  /** 主文本 */
  label: string
  /** 右侧数值 */
  value?: string | number
  /** 次要说明 */
  meta?: string
  /** 状态色（左侧小圆点） */
  status?: 'success' | 'warning' | 'danger' | 'info'
}

/** 大屏图表通用 props */
export interface ScreenChartProps {
  title?: string
  height?: string | number
  loading?: boolean
  empty?: boolean
}

export interface ScreenLineChartProps extends ScreenChartProps {
  categories: string[]
  series: Array<{ name: string; data: number[]; color?: string }>
  /** 是否平滑，默认 true */
  smooth?: boolean
  /** 是否显示面积，默认 true */
  area?: boolean
}

export interface ScreenBarChartProps extends ScreenChartProps {
  categories: string[]
  series: Array<{ name: string; data: number[]; color?: string }>
  /** 是否堆叠，默认 false */
  stacked?: boolean
}

export interface ScreenPieChartProps extends ScreenChartProps {
  data: Array<{ name: string; value: number; color?: string }>
  /** 内径占比，默认 0.6 */
  innerRadius?: number
  /** 中心数值 */
  centerValue?: string | number
  /** 中心文案 */
  centerLabel?: string
}

export interface ScreenGaugeChartProps extends ScreenChartProps {
  /** 当前值 */
  value: number
  /** 最大值，默认 100 */
  max?: number
  /** 单位 */
  unit?: string
  /** 标题 */
  label?: string
}
