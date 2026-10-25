# 设计稿：`@fbk/data` 契约层

> 企业级前端架构优先级计划的 P0。见 `docs/enterprise-architecture.md`。

## 一、为什么需要它

### 1.1 问题

现在 `apps/admin` 里每个列表页都要手写一遍「形状转换」：

```ts
// mock/data.ts 里的 fetchOrders（约 40 行）
export async function fetchOrders(params: TableRequestParams) {
  await delay(params.signal)
  const { keyword, status, channel, dateRange } = params.params as {...}
  let rows = ORDERS.slice()
  if (keyword) rows = rows.filter(...)
  if (status) rows = rows.filter(...)
  // ... 排序、分页、组装 { list, total }
}
```

接真实后端时，这 40 行会变成：

```ts
const res = await http.get('/api/order/list', {
  params: { pageNum: page, pageSize, ...params },
  signal,
})
// 后端返回 { code, msg, rows, total }
if (res.data.code !== 200) throw new Error(res.data.msg)
return { list: res.data.rows, total: res.data.total }
```

**这段代码每个列表页都要写一遍，而且每个人写法都不一样。**

### 1.2 真正的痛点不是「省几行」

是这三件事：

| 痛点 | 后果 |
|---|---|
| 后端改字段（`rows` → `list`） | 每个页面都要改，且编译期发现不了（`any` 透传） |
| 错误处理不统一 | 有的抛异常、有的返回空数组、有的 console.log |
| 分页/排序/筛选的联动 | 每个人都要重新想一遍「筛选后要不要回第 1 页」 |

### 1.3 为什么放进库而不是让业务方自己封装

因为**这些约定一旦不统一，组件库的价值就被抵消了**：
`ProTable` 期望 `{ list, total }`，业务方各自封装出 5 种形状，
最后每处都要写一层适配 —— 组件库省下的代码又被还回去了。

---

## 二、设计

### 2.1 分层

```
@fbk/data          通用契约（与后端无关）
   ↑
业务方              只写「字段在哪」
```

**`@fbk/data` 不知道任何后端规范**（不知道 ruoyi、不知道 Spring Page）。
它只知道「怎么从任意形状里取出一页数据」。

### 2.2 核心类型

```ts
/** 一页数据。与 TableResponse 同形，保证兼容 */
export interface Page<T> {
  list: T[]
  total: number
  hasMore?: boolean
}

/** 分页查询。与 TableRequestParams 同形，保证兼容 */
export interface PageQuery {
  page: number
  pageSize: number
  sort: SortState | null
  params: Record<string, any>
  signal: AbortSignal
}

export type PageFetcher<T> = (query: PageQuery) => Promise<Page<T>>
```

**兼容性要求**：`TableRequest<T>` 改成 `PageFetcher<T>` 的类型别名，
现有所有调用零改动。

### 2.3 `createPageRequest`

```ts
export interface CreatePageRequestConfig<TRaw, T> {
  /** 实际发请求。由调用方注入，库不内置 HTTP 客户端 */
  fetch: (query: PageQuery) => Promise<TRaw>

  /** 列表在响应里的位置。字符串用点号路径，或直接给函数 */
  rows: string | ((raw: TRaw) => unknown[])

  /** 总数位置。不传时用 rows.length */
  total?: string | ((raw: TRaw) => number)

  /** 行映射：把后端原始行转成业务模型 */
  mapRow?: (raw: unknown, index: number) => T

  /** 业务码判定。不传视为 HTTP 层已保证成功 */
  isSuccess?: (raw: TRaw) => boolean

  /** 失败时的错误信息提取 */
  errorMessage?: (raw: TRaw) => string

  /**
   * 数据级权限声明。
   * 'server-filtered' 表示数据已由服务端按权限过滤（正确做法）
   * 其他值会在 dev 环境 warn —— 前端隐藏不构成权限
   */
  scope?: 'server-filtered' | 'client-filtered'
}
```

**用法（ruoyi）**：

```ts
export const fetchOrders = createPageRequest<RuoyiResponse<OrderRow>, OrderRow>({
  fetch: ({ page, pageSize, params, signal }) =>
    http.get('/api/order/list', {
      params: { pageNum: page, pageSize, ...params },
      signal,
    }),
  rows: 'rows',
  total: 'total',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  scope: 'server-filtered',
})
```

**用法（Spring 标准分页）**：

```ts
createPageRequest({
  fetch,
  rows: 'content',
  total: 'totalElements',
})
```

同一套 API，换两个字符串。

### 2.4 路径解析

支持点号路径，**必须支持数组下标**（真实后端常有 `data.records`、`data.list`）：

```ts
getByPath(raw, 'rows')                 // raw.rows
getByPath(raw, 'data.records')         // raw.data.records
getByPath(raw, 'data.list.0.items')    // 数组下标
```

路径不存在时：**抛错而不是返回 undefined**。
理由：静默返回 `undefined` 会让列表变成空数组，
用户看到「暂无数据」，而真正的原因是字段名写错了 —— 这类 bug 极难排查。

### 2.5 错误处理约定

| 场景 | 行为 |
|---|---|
| `isSuccess` 返回 false | 抛 `FbkDataError`，带 `errorMessage` 提取的文案 |
| 路径不存在 | 抛 `FbkDataError`，带实际响应结构（截断 500 字符） |
| `fetch` 抛异常 | 原样向上抛（保留 `AbortError` 语义） |
| `AbortSignal` 已取消 | 不吞异常，让调用方按取消处理 |

**不吞异常**是关键：`use-table-request.ts` 已经正确处理了 `AbortError`
（`if (controller.signal.aborted) return`），库吞掉反而破坏它。

### 2.6 数据级权限

`scope` 参数的真正价值不是运行时行为，是**把认知写进代码**：

```ts
scope: 'client-filtered'  // dev 环境 warn：
// [fbk] 数据级权限必须由服务端过滤。前端隐藏不构成权限 ——
// 列表接口已返回全部数据，任何人都能在 Network 面板看到。
```

这条 warn 比任何文档都有效，因为它出现在**写代码的那一刻**。

---

## 三、包结构

```
packages/data/
  src/
    types.ts      Page / PageQuery / PageFetcher
    path.ts       getByPath（点号路径 + 数组下标）
    error.ts      FbkDataError
    create.ts     createPageRequest
    index.ts
  tests/
    path.spec.ts
    create.spec.ts
```

**依赖**：`@fbk/shared`（仅类型）、`@fbk/tokens`（无运行时用途，但保持依赖图一致）
**不依赖**：`@fbk/adapter-core`（数据层与 UI 无关）

---

## 四、门禁接入

| 门禁 | 动作 |
|---|---|
| `PUBLISHED_PACKAGES`（eslint + dependency-cruiser + check-runtime-deps） | 加入 `packages/data` |
| `check-type-surface` | 扩展：`@fbk/data` 的 d.ts 不得出现第三方 SDK 类型 |
| `check-styles` | 无样式，跳过 |
| `verify` | build 自动覆盖 |

---

## 五、验收标准

| 项 | 标准 |
|---|---|
| 兼容 | `TableRequest` 现有用法零改动（类型别名） |
| 减少代码 | `apps/admin` 的 `fetchOrders` / `fetchUsers` 各减少 30+ 行 |
| ruoyi 示例 | 新增 `fetchRuoyiOrders`，`rows: 'rows'` + `isSuccess: code===200` |
| 错误 | 路径错误抛 `FbkDataError` 且消息含实际响应片段 |
| 取消 | `AbortSignal` 取消时抛 `AbortError`，不被吞 |
| 权限 | `scope: 'client-filtered'` 在 dev 环境 warn |
| 单测 | 路径解析、错误分支、取消、mapRow 全覆盖 |
| 门禁 | `pnpm verify` 全绿 |

---

## 六、不做的事

| 不做 | 理由 |
|---|---|
| 内置 axios / fetch 封装 | 违反第一类禁止依赖，传输层必须注入 |
| 内置缓存 | 缓存策略与应用状态强相关，库不该猜 |
| 内置重试 | 同上；`fetch` 注入后业务方可自行包装 |
| 认识具体后端 | 一旦认识 ruoyi，就要认识 Spring、GraphQL…… |
| 状态管理 | 数据层只做「形状转换」，不持有全局状态 |

---

## 七、设计记录

| 日期 | 改动 | 验收 |
|---|---|---|
| 2026-10-25 | 新增 `@fbk/data` 契约层 | 见第五节 |
