import type { DescriptionGroup, DescriptionItem } from '../descriptions'
import type { DetailPageSlots } from '../detail-page'
import type { Size } from '@fbkworks/adapter-core'

/**
 * 详情抽屉 props。设计见 docs/design/2026-10-28-p4-2-detail-drawer.md。
 *
 * **字段渲染不另起一套**：`items` 与开关项直接沿用 `DetailPage` 的
 * `DescriptionItem` / `DescriptionGroup`，内部也真的把 `FbkDetailPage`
 * 装进抽屉 —— 同一份数据在页面与抽屉里表现一致，不需要两处对齐。
 *
 * 刻意不做的事（与 CrudPage 的「只负责列表这一屏」一脉相承）：
 *   · 不内置请求库 —— `request` 由调用方注入，与 `useDetail` 同一契约
 *   · 不做路由跳转 —— 「展开为整页」只发 `expand` 事件（库不该假设 SPA 结构）
 *   · 不塞进 `CrudPage` —— 与它的关系是 slot 组合，它的 props 与行为零变化
 */
export interface DetailDrawerProps<T extends Record<string, any> = Record<string, any>> {
  /** 显隐，支持 v-model:show。与 FormModal 一致：受控，组件自己不翻转 */
  show?: boolean

  /**
   * 取详情。返回 `null` 表示资源不存在（抽屉内渲染 404）。
   *
   * `show` 由 false 变 true 时会重新请求 —— 重新打开拿到的是最新数据。
   * 同一个打开周期内换 `request` 不会重新请求（与 DetailPage 一致，
   * 需要时用暴露的 `reload()`）。
   */
  request: () => Promise<T | null>

  /** 字段描述。直接透传给 FbkDetailPage → FbkDescriptions */
  items: DescriptionItem<T>[]

  /** 标题。传函数时可用数据里的字段（如 `(d) => d.orderNo`） */
  title?: string | ((data: T) => string)

  /**
   * 桌面宽度。默认 480。移动端一律铺满整屏，忽略此值。
   *
   * 默认值刻意不用百分比：详情字段的换行位置需要确定
   * （648px 与 640px 下同一行长什么样不该由视口决定）。
   */
  width?: string | number

  /** 点遮罩是否关闭，默认 true */
  closeOnClickModal?: boolean
  /** 是否显示标题栏关闭控件，默认 true */
  showClose?: boolean

  /** 「展开为整页」按钮文案，默认「展开为整页」 */
  expandText?: string
  /** 是否显示「展开为整页」出口，默认 true。业务方没有整页时关掉它 */
  showExpand?: boolean

  /* ---------- 以下直接透传给 FbkDetailPage → FbkDescriptions ---------- */

  /** 列数。抽屉窄，默认 1 列（DetailPage 是 2 列） */
  column?: number | { xs?: number; sm?: number; md?: number; lg?: number }

  /** 分组定义 */
  groups?: DescriptionGroup[]

  /** 字段为空时的占位文本 */
  emptyText?: string

  /** 是否显示边框 */
  bordered?: boolean

  /** 标签与值的排布方向 */
  direction?: 'horizontal' | 'vertical'

  /** 尺寸 */
  size?: Size
}

/** 插槽与 DetailPage 完全一致：field-${key} / extra / actions / loading / error */
export type DetailDrawerSlots<T extends Record<string, any> = Record<string, any>> =
  DetailPageSlots<T>

export interface DetailDrawerExpose<T = any> {
  /** 当前详情数据（未加载或 404 时为 null） */
  data: T | null
  /** 重新请求 */
  reload: () => Promise<void>
  /** 关闭（等价于 emit update:show(false)） */
  close: () => void
}
