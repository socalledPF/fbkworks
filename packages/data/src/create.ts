import { warnOnce } from '@fbkworks/shared'
import { FbkDataError } from './error'
import { extractRows, extractTotal } from './path'
import type {
  CreatePageRequestConfig,
  Page,
  PageFetcher,
  PageQuery,
  PageRequestErrorEvent,
} from './types'

/**
 * 把「任意形状的后端响应」映射成组件库期望的 `Page<T>`。
 *
 * 这是 @fbkworks/data 的核心：业务方只写「字段在哪」，
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
  const { fetch, rows, total, mapRow, isSuccess, errorMessage, scope, onError, feature } = config

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

  /** 统一的错误上报。不上报 AbortError —— 取消不是错误 */
  const report = (event: PageRequestErrorEvent) => {
    if (!onError) return
    try {
      onError(event)
    } catch {
      /* 上报器自身抛错不能影响业务请求 */
    }
  }

  /** 参数快照：只留可复现所需的最小信息，避免大对象进日志 */
  const snapshot = (query: PageQuery): Record<string, unknown> => ({
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    params: query.params,
  })

  return async (query) => {
    let raw: TRaw
    try {
      raw = await fetch(query)
    } catch (err) {
      /* 取消是正常流程（快速翻页时旧请求被 abort），不能当成错误上报 —— 否则监控里全是噪音。
         判据要覆盖三种真实形状：
           · fetch 原生取消      → DOMException('AbortError')
           · axios v1 signal 取消 → CanceledError（name='CanceledError', code='ERR_CANCELED'）
           · abort(customReason)  → 直接以 reason 拒约，形状任意
         最后一种无法靠形状识别，所以**第一判据看 signal 本身**：调用方已经 abort 了，
         那么无论抛出来的是什么，都不该算错误。 */
      const canceledBySignal = query.signal?.aborted === true
      const cancelLike =
        typeof err === 'object' &&
        err !== null &&
        ((err as { name?: string }).name === 'AbortError' ||
          (err as { name?: string }).name === 'CanceledError' ||
          (err as { code?: string }).code === 'ERR_CANCELED')
      const aborted = canceledBySignal || cancelLike
      if (!aborted) {
        report({
          source: 'request',
          feature,
          message: err instanceof Error ? err.message : String(err),
          cause: err,
          context: snapshot(query),
        })
      }
      throw err
    }

    /* 业务码判定。
       有业务码的后端（ruoyi 的 code===200）如果不传 isSuccess，
       失败响应会被当成空列表 —— 用户看到「暂无数据」，
       而真实原因是 token 过期或参数错误。 */
    /* isSuccess / errorMessage 是调用方给的函数，它们自己也可能抛错 ——
       最常见的是空 body（raw 是 null/undefined）时读 `raw.code`。
       这两行以前在 try 之外：异常直接冒成裸 TypeError，onError 一次都收不到，
       等于「请求失败了但监控里什么都没有」。 */
    if (isSuccess) {
      let ok: boolean
      let message: string | undefined
      try {
        ok = isSuccess(raw)
        if (!ok) message = errorMessage?.(raw)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        const wrapped = new FbkDataError(
          'business',
          `[fbk/data] isSuccess/errorMessage 判定抛错（${reason}）。响应可能是空 body 或结构不符。`,
          raw,
        )
        report({
          source: 'request',
          feature,
          message: wrapped.message,
          cause: err,
          raw,
          context: snapshot(query),
        })
        throw wrapped
      }

      /* 判据必须是「falsy 即失败」，不能写 ok === false：
         `isSuccess: (res) => res.code`、`(res) => res.data?.ok`、`(res) => res.status`
         这些写法返回的是 undefined / 0 / '' ，用 === false 会把业务失败全部放过 ——
         失败响应带空数组时用户看到「暂无数据」，不带数组时报「列表位置不是数组」，
         把排查引到字段名上。`!ok` 才是「不是成功」的意思。 */
      if (!ok) {
        const text = message ?? '请求失败（未提供 errorMessage）'
        report({
          source: 'request',
          feature,
          message: text,
          raw,
          context: snapshot(query),
        })
        throw new FbkDataError('business', text, raw)
      }
    }

    try {
      const rawRows = extractRows(raw, rows)
      const totalValue = total !== undefined ? extractTotal(raw, total) : rawRows.length

      const list = mapRow
        ? rawRows.map((item, index) => mapRow(item, index))
        : (rawRows as unknown as T[])

      return { list, total: totalValue } satisfies Page<T>
    } catch (err) {
      /* 路径解析失败是**开发期错误**（字段名写错），
         但线上同样会走到这里，所以也要上报。 */
      report({
        source: 'request',
        feature,
        message: err instanceof Error ? err.message : String(err),
        raw,
        cause: err,
        context: snapshot(query),
      })
      throw err
    }
  }
}
