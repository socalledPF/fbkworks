# 设计稿：`defineBackend` —— 后端惯例复用

> 解决 `createPageRequest` 在真实项目中的重复问题。

## 一、问题

真实项目里一个系统通常只有 **1-2 种响应形状**。
但当前 API 要求每个列表接口重复描述它：

```ts
// 12 个接口 × 6 行相同配置 = 72 行，其中 60 行是纯重复
export const fetchOrders = createPageRequest({
  fetch: ..., rows: 'content', total: 'totalElements',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  feature: 'order.list',
})
export const fetchUsers = createPageRequest({
  fetch: ..., rows: 'content', total: 'totalElements',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  feature: 'user.list',
})
// ... 再重复 10 次
```

**这是设计缺口，不是用法问题。** 一次决策被摊成了 12 次重复。

## 二、目标

把「后端惯例」与「接口特有信息」分开：

| 属于后端惯例（全项目一次） | 属于接口（每个不同） |
|---|---|
| 传输层怎么发请求 | URL |
| `rows` / `total` 在哪 | `feature` 标识 |
| 业务码怎么判 | `mapRow` 字段映射 |
| 错误消息怎么取 | 特有的查询参数映射 |

## 三、设计

### 3.1 `defineBackend`

```ts
// src/api/backend.ts —— 全项目唯一一处描述后端惯例
import { defineBackend } from '@fbk/data'

export const api = defineBackend({
  /* A 形态的基础：传输层。
     签名固定 —— (url, params, signal) => Promise<TRaw> */
  request: (url, params, signal) =>
    http.get(url, { params, signal }).then((r) => r.data),

  rows: 'content',
  total: 'totalElements',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  scope: 'server-filtered',
})
```

### 3.2 两种接口形态（A + B）

**A. 传路径** —— 常规接口一行搞定

```ts
export const fetchOrders = api.page('/api/order/list', {
  feature: 'order.list',
})
```

内部把 `PageQuery` 转成后端期望的参数名（`pageNum` / `pageSize`）再调 `request`。

**B. 传 fetcher** —— 特殊接口的逃生口

```ts
export const fetchOrders = api.page(({ page, pageSize, params, signal }) =>
  http.get(`/api/${tenant}/order/list`, {
    params: { pageNum: page, pageSize, ...params },
    signal,
  }),
)
```

适用于：URL 需要动态拼接、参数名与惯例不同、需要特殊 header。

**判定方式**：`api.page` 的第一个参数是 `string` 用 A，是 `function` 用 B。
不用两个方法名 —— 心智负担低，且调用处一眼能看出用的是哪种。

### 3.3 顺带解决的：`get` / `post`

详情与写操作也要走同样的业务码判定，否则每个详情接口都要手写
`if (res.code !== 200) throw`。

```ts
export const fetchOrder = api.get<Order>('/api/order/detail')
export const saveOrder = api.post<Order>('/api/order/save')
```

> 这部分**本轮不做**。先把 `page` 做扎实，`get`/`post` 单独一轮。
> 理由：`get`/`post` 涉及请求体序列化、幂等性、取消语义，
> 和分页是不同的问题域，混在一起会让 API 变形。

### 3.4 参数名映射

后端常用 `pageNum`/`pageSize`，而 `PageQuery` 是 `page`/`pageSize`。

`defineBackend` 提供 `mapParams`：

```ts
defineBackend({
  request: ...,
  // 默认把 page 映射成 pageNum
  mapParams: ({ page, pageSize, params }) => ({
    pageNum: page,
    pageSize,
    ...params,
  }),
})
```

**默认值**：不传时直接用 `{ page, pageSize, ...params }`，
即假设后端用 `page`/`pageSize`。Spring 项目需要显式传 `mapParams`
把 `page` 改成 `pageNum`——因为那是**后端的惯例，不是普适的**。

### 3.5 覆盖与合并

单个接口可以覆盖后端的任意配置：

```ts
api.page('/api/legacy/list', {
  // 老接口用 rows/total 而不是 content/totalElements
  rows: 'rows',
  total: 'total',
  feature: 'legacy.list',
})
```

合并规则：`接口配置 > defineBackend 配置 > 默认值`，浅合并。

## 四、API 形状

```ts
export interface BackendConfig<TRaw = any> {
  /** 传输层。签名固定，A 形态依赖它 */
  request: (url: string, params: Record<string, any>, signal: AbortSignal) => Promise<TRaw>

  rows: PathSpec<TRaw>
  total?: PathSpec<TRaw>
  isSuccess?: (raw: TRaw) => boolean
  errorMessage?: (raw: TRaw) => string
  scope?: DataScope
  onError?: (event: PageRequestErrorEvent) => void

  /** PageQuery → 后端参数名。不传则直接用 page/pageSize */
  mapParams?: (query: PageQuery) => Record<string, any>
}

export interface Backend<TRaw = any> {
  /** A：传路径；B：传 fetcher */
  page<T = unknown>(
    pathOrFetcher:
      | string
      | ((query: PageQuery) => Promise<TRaw>),
    options?: Partial<Omit<CreatePageRequestConfig<TRaw, T>, 'fetch'>> & {
      feature?: string
    },
  ): PageFetcher<T>

  /** 底层配置，便于测试与高级用法 */
  readonly config: BackendConfig<TRaw>
}

export function defineBackend<TRaw = any>(config: BackendConfig<TRaw>): Backend<TRaw>
```

## 五、实现要点

`defineBackend` 内部**复用 `createPageRequest`**，不重写一套：

```ts
function page(pathOrFetcher, options = {}) {
  const fetch = typeof pathOrFetcher === 'function'
    ? pathOrFetcher
    : (query) => config.request(pathOrFetcher, mapParams(query), query.signal)

  return createPageRequest({
    ...backendDefaults,      // rows/total/isSuccess/errorMessage/scope/onError
    ...options,              // 接口级覆盖
    fetch,
  })
}
```

这样错误上报、路径解析、AbortError 不吞等行为**自动继承**，
不会出现两套实现漂移。

## 六、验收

| 项 | 标准 |
|---|---|
| A 形态 | 传字符串路径能正确请求并解析 |
| B 形态 | 传 fetcher 能绕过 `request` |
| 覆盖 | 接口级 `rows` 覆盖后端的 `rows` |
| mapParams | 能把 `page` 映射成 `pageNum` |
| 复用 | 12 个接口的后端配置只写一次 |
| 兼容 | `createPageRequest` 行为完全不变 |
| 单测 | A/B/覆盖/mapParams/错误传播五个分支 |

## 七、不做

| 不做 | 理由 |
|---|---|
| 内置 `presets: 'spring'` | 一旦认识 Spring 就要认识 ruoyi / GraphQL / OData，维护成本无上限 |
| `get` / `post` | 与分页是不同问题域，单独一轮 |
| 请求缓存 | 缓存策略与应用状态强相关 |
| 自动重试 | 同上，`request` 注入后业务方可自行包装 |
