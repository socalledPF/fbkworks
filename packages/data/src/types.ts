/**
 * 数据层契约类型。
 *
 * **这里是分页契约的唯一定义处。** `@fbk/components` 的
 * `TableRequestParams` / `TableResponse` / `TableRequest` 都是
 * 本文件类型的别名 —— 改这里就会一起变，不存在两处漂移。
 *
 * 设计原则（见 docs/design/2026-10-25-fbk-data-contract.md）：
 *   · 与**后端规范无关** —— 不认识 ruoyi、Spring、GraphQL
 *   · 与 **UI 库无关** —— 不依赖 @fbk/adapter-core
 *   · 传输层注入 —— 不内置 axios / fetch
 */

/**
 * 排序状态。
 *
 * 与 `@fbk/adapter-core` 的 `SortState` 结构一致，但这里独立声明：
 * 数据层不该为了一个两字段的结构去依赖 UI 适配层。
 * 一致性由 `packages/data/tests/contract.spec.ts` 的类型断言保证。
 */
export interface PageSort {
  field: string
  order: 'asc' | 'desc' | null
}

/**
 * 一页数据。
 *
 * `total` 必填 —— `createPageRequest` 一定会算出总数
 * （没有 total 字段时取 rows.length）。业务方手写 fetcher 时
 * 若拿不到总数，用 `TableResponse`（它的 total 是可选的）。
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
 * `signal` 是必须的 —— 竞态处理（快速翻页时丢弃旧响应）依赖它。
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

  /**
   * 业务标识，用于在错误上报里区分是哪个接口。
   * 通常传接口名，如 'order.list'。
   */
  feature?: string

  /**
   * 错误钩子。请求失败、业务码失败、路径解析失败都会走它。
   *
   * 为什么是**注入回调**而不是读全局 reporter：
   * 这个包是纯逻辑层，不依赖 Vue 也不依赖 adapter-core。
   * 业务方在应用入口把它接到统一的 onError 即可：
   * ```ts
   * createPageRequest({
   *   fetch, rows: 'rows',
   *   onError: (event) => reporter.error(event),
   * })
   * ```
   */
  onError?: (event: PageRequestErrorEvent) => void
}

/** 数据层错误事件。与 adapter-core 的 FbkErrorEvent 形状对齐，但不依赖它 */
export interface PageRequestErrorEvent {
  /** 固定为 'request'，与 FbkErrorEvent.source 对齐 */
  source: 'request'
  /** 业务标识：通常是接口名，由 feature 选项提供 */
  feature?: string
  message: string
  /** 原始响应（截断后）。网络层错误时为 undefined */
  raw?: unknown
  /** 原始异常（fetch 抛错时） */
  cause?: unknown
  /** 本次请求的参数快照（用于复现） */
  context?: Record<string, unknown>
}
