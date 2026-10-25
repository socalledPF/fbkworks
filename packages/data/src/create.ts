import { warnOnce } from '@fbk/shared'
import { FbkDataError } from './error'
import { extractRows, extractTotal } from './path'
import type { CreatePageRequestConfig, Page, PageFetcher } from './types'

/**
 * 把「任意形状的后端响应」映射成组件库期望的 `Page<T>`。
 *
 * 这是 @fbk/data 的核心：业务方只写「字段在哪」，
 * 不写分页、不写错误处理、不写类型转换。
 *
 * ```ts
 * // ruoyi
 * export const fetchOrders = createPageRequest({
 *   fetch: ({ page, pageSize, params, signal }) =>
 *     http.get('/api/order/list', { params: { pageNum: page, pageSize, ...params }, signal }),
 *   rows: 'rows',
 *   total: 'total',
 *   isSuccess: (res) => res.code === 200,
 *   errorMessage: (res) => res.msg,
 *   scope: 'server-filtered',
 * })
 * ```
 */
export function createPageRequest<TRaw, T = unknown>(
  config: CreatePageRequestConfig<TRaw, T>,
): PageFetcher<T> {
  const { fetch, rows, total, mapRow, isSuccess, errorMessage, scope } = config

  /* 数据级权限提醒。
     这不是运行时校验 —— 前端无法真正校验权限。它的价值在于
     把「前端隐藏不构成权限」这件事，出现在写代码的那一刻。 */
  if (scope === 'client-filtered') {
    warnOnce(
      'data-scope-client-filtered',
      '[fbk/data] scope 为 client-filtered：数据级权限必须由服务端过滤。\n' +
        '  前端隐藏不构成权限 —— 列表接口已返回全部数据，\n' +
        '  任何用户都能在浏览器 Network 面板看到完整内容。\n' +
        '  如果服务端确实做了过滤，请改为 scope: "server-filtered"。',
    )
  }

  return async (query) => {
    const raw = await fetch(query)

    /* 业务码判定。
       有业务码的后端（ruoyi 的 code===200）如果不传 isSuccess，
       失败响应会被当成空列表 —— 用户看到「暂无数据」，
       而真实原因是 token 过期或参数错误。 */
    if (isSuccess && !isSuccess(raw)) {
      const message = errorMessage?.(raw) ?? '请求失败（未提供 errorMessage）'
      throw new FbkDataError('business', message, raw)
    }

    const rawRows = extractRows(raw, rows)
    const totalValue = total !== undefined ? extractTotal(raw, total) : rawRows.length

    const list = mapRow
      ? rawRows.map((item, index) => mapRow(item, index))
      : (rawRows as unknown as T[])

    return { list, total: totalValue } satisfies Page<T>
  }
}

/**
 * 把 `Page` 转成 `TableResponse`。
 *
 * 结构本来就同形，这个函数存在的意义是**类型收窄**：
 * 让 `@fbk/data` 不依赖 `@fbk/components` 也能证明兼容性。
 */
export function toTableResponse<T>(page: Page<T>): {
  list: T[]
  total: number
  hasMore?: boolean
} {
  return { list: page.list, total: page.total, hasMore: page.hasMore }
}
