import type { VNodeChild } from 'vue'
import type { Size } from '@fbk/adapter-core'

export interface DescriptionItem<T = Record<string, any>> {
  key: string
  label: string
  dataIndex?: (keyof T & string) | string
  getValue?: (row: T) => unknown
  span?: number
  render?: (ctx: { row: T; value: unknown }) => VNodeChild
  /**
   * 该条目在哪些分组里显示。
   * 不传时若存在 groups，则显示在第一个分组；传空数组表示只在「未分组」区显示。
   */
  groups?: string[]
  /** 值为空时的占位符，默认 '-' */
  emptyText?: string
}

/**
 * 分组。详情页常见「基本信息 / 联系方式 / 扩展属性」三段式，
 * 此前只能用多个 Descriptions 拼，标题层级与间距都要手动对齐。
 */
export interface DescriptionGroup {
  /** 分组标识，与 item.groups 对应 */
  key: string
  title?: string
  /** 该分组独立的列数，不传则继承组件级 column */
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  /** 是否可折叠 */
  collapsible?: boolean
  /** 默认是否折叠（仅 collapsible 时生效） */
  defaultCollapsed?: boolean
}

export interface DescriptionsProps<T = Record<string, any>> {
  items: DescriptionItem<T>[]
  data: T
  /**
   * 分组定义。传了之后按 item.groups 归组渲染；
   * 不属于任何分组的条目会渲染在最后（没有标题）。
   */
  groups?: DescriptionGroup[]
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  bordered?: boolean
  direction?: 'horizontal' | 'vertical'
  size?: Size
  labelWidth?: string
  /** 分组之间的间距，默认 md */
  groupGap?: 'sm' | 'md' | 'lg'
}

/** 分组后的渲染单元 */
export interface ResolvedGroup<T = Record<string, any>> {
  key: string
  title?: string
  items: DescriptionItem<T>[]
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  collapsible: boolean
  defaultCollapsed: boolean
}
