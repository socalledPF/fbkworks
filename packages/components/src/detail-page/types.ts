import type { VNodeChild } from 'vue'
import type { BreadcrumbItem } from '../page-container'
import type { DescriptionGroup, DescriptionItem } from '../descriptions'

/**
 * 详情页 props。
 *
 * 设计见 docs/design/2026-10-25-detail-page.md。
 *
 * **不另设计字段描述**：`items` 直接复用 `DescriptionItem`。
 * 两套字段描述会让用户困惑 —— Descriptions 里能写的，
 * 详情页里应该也能写。
 */
export interface DetailPageProps<T extends Record<string, any> = Record<string, any>> {
  /**
   * 取详情。返回 `null` 表示资源不存在（渲染 404）。
   *
   * 刻意不带分页参数 —— 详情就是取一条。
   */
  request: () => Promise<T | null>

  /** 字段描述。直接透传给 FbkDescriptions */
  items: DescriptionItem<T>[]

  /** 标题。传函数时可用数据里的字段（如 `(d) => d.orderNo`） */
  title?: string | ((data: T) => string)

  /** 副标题 */
  subtitle?: string

  /** 面包屑 */
  breadcrumbs?: BreadcrumbItem[]

  /** 返回按钮。true 时用默认处理，也可传回调 */
  back?: boolean | (() => void)

  /** 列数，透传 Descriptions */
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }

  /** 分组定义，透传 Descriptions */
  groups?: DescriptionGroup[]

  /** 字段为空时的占位文本 */
  emptyText?: string

  /** 挂载即请求，默认 true */
  immediate?: boolean

  /** 是否显示页面头部，默认 true */
  showHeader?: boolean
}

/** 详情页暴露的方法 */
export interface DetailPageExpose<T> {
  data: T | null
  loading: boolean
  error: unknown
  reload: () => Promise<void>
}

export interface DetailPageSlots<T> {
  /** 额外区块：接在字段区之后（时间线、关联列表等） */
  extra?: (props: { data: T }) => VNodeChild
  /** 操作区：接在页面底部 */
  actions?: (props: { data: T }) => VNodeChild
  /** 加载态覆盖 */
  loading?: () => VNodeChild
  /** 错误态覆盖 */
  error?: (props: { error: unknown; retry: () => void }) => VNodeChild
  /** 单字段覆盖渲染，插槽名 `field-${key}` */
  [fieldSlot: `field-${string}`]: ((props: { data: T; value: unknown }) => VNodeChild) | undefined
}
