import { createPageRequest } from './create'
import type {
  Backend,
  BackendConfig,
  CreatePageRequestConfig,
  PageFetcher,
  PageQuery,
} from './types'

/**
 * 定义一个后端的响应惯例，之后每个接口只需写自己的部分。
 *
 * 真实项目里一个系统通常只有 1-2 种响应形状。
 * 没有这一层，12 个接口要重复 12 遍 `rows` / `total` / `isSuccess` ——
 * 一次决策被摊成 12 次重复。
 *
 * ```ts
 * // src/api/backend.ts —— 全项目唯一一处
 * export const api = defineBackend({
 *   request: (url, params, signal) => http.get(url, { params, signal }).then((r) => r.data),
 *   rows: 'content',
 *   total: 'totalElements',
 *   isSuccess: (res) => res.code === 200,
 *   errorMessage: (res) => res.msg,
 *   scope: 'server-filtered',
 * })
 *
 * // src/api/order.ts —— 每个接口只剩自己的信息
 * export const fetchOrders = api.page('/api/order/list', { feature: 'order.list' })
 * ```
 *
 * **刻意不提供 `presets: 'spring'` 这种内置预设。**
 * 一旦库认识 Spring，就要认识 ruoyi、GraphQL、OData……维护成本无上限。
 * 让业务方写三个字符串，比让库猜要稳。
 */
export function defineBackend<TRaw = any>(config: BackendConfig<TRaw>): Backend<TRaw> {
  const {
    request,
    rows,
    total,
    isSuccess,
    errorMessage,
    scope,
    onError,
    mapParams,
  } = config

  /** 后端惯例部分。接口级配置会覆盖它 */
  const defaults = { rows, total, isSuccess, errorMessage, scope, onError }

  /**
   * 把 PageQuery 转成后端期望的参数名。
   *
   * 不传时直接用 `{ page, pageSize, ...params }` ——
   * 这是**约定而不是猜测**：`page` 是最中性的命名。
   * 后端用 `pageNum` 的项目显式传 mapParams，因为那是它的惯例。
   */
  const toParams = (query: PageQuery): Record<string, any> =>
    mapParams
      ? mapParams(query)
      : { page: query.page, pageSize: query.pageSize, ...query.params }

  function page<T = unknown>(
    pathOrFetcher: string | ((query: PageQuery) => Promise<TRaw>),
    options: Partial<Omit<CreatePageRequestConfig<TRaw, T>, 'fetch'>> = {},
  ): PageFetcher<T> {
    /* 两种形态共用同一个入口，靠参数类型区分：
         string   → A 形态，用后端惯例的 request 发请求
         function → B 形态，逃生口，调用方自己发请求
       不用两个方法名：调用处一眼能看出用的哪种，心智负担也低。 */
    const fetch =
      typeof pathOrFetcher === 'function'
        ? pathOrFetcher
        : (query: PageQuery) => request(pathOrFetcher, toParams(query), query.signal)

    /* 顺序即优先级：接口配置覆盖后端惯例。
       但**显式传 undefined 不算「给了值」** —— 展开运算符做不到这一点：
       `{ ...defaults, ...{ total: undefined } }` 会把 total 覆盖成 undefined，
       于是后端惯例被静默关掉。实测：`api.page(url, { total: undefined })`
       拿到的是兜底的 2 而不是后端的 57；`isSuccess: undefined` 更糟 ——
       业务码判定整个失效，失败响应会被当成空列表。
       这种写法很常见（`{ total: opts?.total }`），所以这里逐个过滤掉 undefined。 */
    const overrides = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    )

    return createPageRequest<TRaw, T>({
      ...defaults,
      ...overrides,
      fetch,
    } as CreatePageRequestConfig<TRaw, T>)
  }

  return {
    page,
    config: { request, rows, total, isSuccess, errorMessage, scope, onError, mapParams },
  }
}
