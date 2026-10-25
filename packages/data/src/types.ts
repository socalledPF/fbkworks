/**
 * 数据层契约类型。
 *
 * 设计原则（见 docs/design/2026-10-25-fbk-data-contract.md）：
 *   · 与**后端规范无关** —— 不认识 ruoyi、Spring、GraphQL
 *   · 与 **UI 库无关** —— 不依赖 @fbk/adapter-core
 *   · 传输层注入 —— 不内置 axios / fetch
 */

/** 排序状态。与 @fbk/adapter-core 的 SortState 同形，但这里不依赖它 */
export interface PageSort {
  field: string
  order: 'asc' | 'desc' | null
}

/**
 * 一页数据。
 *
 * 与 `@fbk/components/pro-table` 的 `TableResponse` 同形 ——
 * 保证 `TableRequest` 能无缝迁移到 `PageFetcher`。
 */
export interface Page<T> {
  list: T[]
  total: number
  /** 无限滚动场景：false 表示没有更多了 */
  hasMore?: boolean
}

/**
 * 分页查询参数。
 *
 * 与 `TableRequestParams` 同形。`signal` 是必须的 ——
 * 竞态处理（快速翻页时丢弃旧响应）依赖它。
 */
export interface PageQuery {
  page: number
  pageSize: number
  sort: PageSort | null
  params: Record<string, any>
  signal: AbortSignal
}

/** 分页取数函数。业务方实现这个即可接入 ProTable / CrudPage */
export type PageFetcher<T> = (query: PageQuery) => Promise<Page<T>>

/**
 * 数据级权限声明。
 *
 * `server-filtered`：数据已由服务端按当前用户权限过滤（正确做法）
 * `client-filtered`：前端拿到全量再隐藏（**不构成权限**，dev 环境会 warn）
 */
export type DataScope = 'server-filtered' | 'client-filtered'

/** 路径：点号字符串，或自定义提取函数 */
export type PathSpec<TRaw> = string | ((raw: TRaw) => unknown)

export interface CreatePageRequestConfig<TRaw, T> {
  /**
   * 实际发请求。由调用方注入。
   *
   * 库刻意不内置 HTTP 客户端 —— 传输层是应用决策（axios / fetch / 自研），
   * 库无权锁定。这条由 eslint 的第一类禁止依赖约束保证。
   */
  fetch: (query: PageQuery) => Promise<TRaw>

  /**
   * 列表在响应里的位置。
   *
   * 字符串用点号路径（支持数组下标），或直接给函数。
   * 例：`'rows'`、`'data.records'`、`(res) => res.data.items`
   */
  rows: PathSpec<TRaw>

  /** 总数位置。不传时用 rows.length（适合一次性返回全部的场景） */
  total?: PathSpec<TRaw>

  /** 行映射：把后端原始行转成业务模型 */
  mapRow?: (raw: unknown, index: number) => T

  /**
   * 业务码判定。不传视为 HTTP 层已保证成功。
   *
   * 有业务码的后端（如 ruoyi 的 `code === 200`）必须传，
   * 否则失败响应会被当成空列表。
   */
  isSuccess?: (raw: TRaw) => boolean

  /** 失败时的错误信息提取 */
  errorMessage?: (raw: TRaw) => string

  /**
   * 数据级权限声明。
   *
   * 传 `'client-filtered'` 会在 dev 环境 warn —— 前端隐藏不构成权限。
   */
  scope?: DataScope
}
