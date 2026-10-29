# 数据层契约

`@fbkworks/data` 把「任意形状的后端响应」映射成组件库期望的 `Page<T>`。
业务方只写「字段在哪」，不写分页、错误处理、类型转换。

**它是分页契约的唯一定义处** —— `ProTable` / `CrudPage` 的
`TableRequest` 就是这里的类型别名，改一处会一起变。

## 安装

```bash
pnpm add @fbkworks/data
```

无运行时依赖，也不需要 UI 库。

## 基础用法

```ts
import { createPageRequest } from '@fbkworks/data'

export const fetchOrders = createPageRequest({
  // 传输层由你注入：axios / fetch / 自研都行
  fetch: ({ page, pageSize, params, signal }) =>
    http.get('/api/order/list', {
      params: { pageNum: page, pageSize, ...params },
      signal,
    }),
  rows: 'rows',        // 列表在响应里的位置
  total: 'total',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  feature: 'order.list',
})
```

然后直接传给 `ProTable` / `CrudPage`：

```vue
<FbkCrudPage :columns="columns" :request="fetchOrders" row-key="id" />
```

## 多个接口复用：`defineBackend`

### 为什么需要它：可审计性，不是省代码

**先说清楚价值不在这里**：12 个接口省下 60 行代码，本身不构成什么收益。

真正的理由是这个场景：

```ts
// ❌ 没有抽象：12 个接口各写一遍
// order.ts
isSuccess: (res) => res.code === 200
// user.ts
isSuccess: (res) => res.code === 200
// goods.ts
isSuccess: (res) => res.code === 200 || res.code === 304   // 有人这么写过
// ... 还有 9 处，你不知道它们是否一致
```

三个月后后端说「加了新错误码需要特殊处理」。你要改 12 个地方，
而且**你无法确认自己找全了**——可能有人写着变体，有人漏了。

```ts
// ✅ 有抽象：唯一一处
isSuccess: (res) => res.code === 200
```

改一处，全项目生效。

同类问题：

| 变更 | 没有抽象 | 有抽象 |
|---|---|---|
| 后端把 `rows` 改名 | 全项目搜字符串 | 改一处 |
| 加统一 token 刷新 | 每个 fetch 各写 | 改 `request` |
| **数据级权限声明** | 容易漏某个接口 | 默认继承，不可能漏 |

最后一条最典型：某个接口忘了写 `scope: 'server-filtered'`，
那个接口的数据级权限声明就缺失了，而且**没有任何测试会发现**。

### 什么时候引入

**从第二个列表接口开始就值得。**

不是「3-4 个才划算」——从第二个接口起，「两处不一致」的风险就已经存在。
按接口数量决定要不要抽象，是拿错了尺子。

### 写法

改为「一次描述后端，每个接口只写自己的部分」：

```ts
// src/api/backend.ts —— 全项目唯一一处
import { defineBackend } from '@fbkworks/data'

export const api = defineBackend({
  request: (url, params, signal) =>
    http.get(url, { params, signal }).then((r) => r.data),
  rows: 'content',
  total: 'totalElements',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  scope: 'server-filtered',
  // Spring 用 pageNum；不传则默认 page
  mapParams: ({ page, pageSize, params }) => ({ pageNum: page, pageSize, ...params }),
})
```

```ts
// src/api/order.ts —— 每个接口只剩自己的信息
export const fetchOrders = api.page('/api/order/list', { feature: 'order.list' })
export const fetchUsers = api.page('/api/user/list', { feature: 'user.list' })
```

### 两种形态

判定方式看第一个参数的类型，不需要记两个方法名：

| 形态 | 写法 | 适用 |
|---|---|---|
| **A** 传路径 | `api.page('/api/order/list')` | 常规接口 |
| **B** 传 fetcher | `api.page(({ page, signal }) => http.get(...))` | URL 动态拼接、特殊 header |

B 形态只接管「怎么发请求」，`rows`/`total` 解析仍用后端配置。

### 接口级覆盖

单个接口可以覆盖后端的任意配置（浅合并，接口优先）：

```ts
// 这个老接口是 ruoyi 风格，不是 Spring
api.page('/api/legacy/list', { rows: 'rows', total: 'total' })
```

### 为什么不内置 `presets: 'spring'`

一旦库认识 Spring，就要认识 ruoyi、GraphQL、OData……维护成本无上限。
让业务方写三个字符串，比让库猜要稳。

## 适配不同后端

换两个字符串即可：

| 后端 | `rows` | `total` |
|---|---|---|
| ruoyi | `'rows'` | `'total'` |
| Spring Data | `'content'` | `'totalElements'` |
| 嵌套结构 | `'data.records'` | `'data.count'` |
| 数组下标 | `'data.list.0.items'` | 函数 |

也可以用函数代替字符串：

```ts
createPageRequest({
  fetch,
  rows: (res) => res.data.items,
  total: (res) => res.data.page.total,
})
```

## 错误处理

三种失败都会抛 `FbkDataError`：

| 场景 | `kind` |
|---|---|
| 业务码失败（`isSuccess` 返回 false） | `'business'` |
| 路径解析失败（字段名写错） | `'path'` |
| 网络层失败 | 原样抛出（保留 `AbortError` 语义） |

**路径解析失败会抛错，而不是返回空数组。** 返回空数组会让用户看到
「暂无数据」，而真实原因是字段名写错 —— 这类 bug 极难排查。

### total 为 null 也会抛错

`Number(null) === 0`、`Number('') === 0`。如果静默转换，
后端返回 `total: null`（「暂无数据」或字段未初始化时很常见）会让
分页器显示「共 0 条」，而实际可能有数据 —— 用户看到错误信息且无报错。

所以 `total` 位置是 `null` / `undefined` / `''` 时抛 `FbkDataError`，
并在消息里给出替代方案（`total: (raw) => rows.length` 或直接不传 `total`）。

### 上报

```ts
createPageRequest({
  fetch, rows: 'rows',
  feature: 'order.list',
  onError: (event) => reporter.error(event),
})
```

`AbortError` **不会上报** —— 取消是正常流程，当成错误会让监控充满噪音。

## 数据级权限

前端**无法**真正做数据级权限：接口返回 1000 条，前端隐藏 900 条，
那 1000 条依然在浏览器 Network 面板里。

所以这个包只做两件事：

```ts
// 1. 显式声明（正确的做法）
createPageRequest({ fetch, rows: 'rows', scope: 'server-filtered' })

// 2. 写错时在 dev 环境提醒
createPageRequest({ fetch, rows: 'rows', scope: 'client-filtered' })
// → [fbk/data] 数据级权限必须由服务端过滤。前端隐藏不构成权限。
```

那条提醒不是运行时校验，它的价值在于**出现在写代码的那一刻**。

## API

| 导出 | 说明 |
|---|---|
| `createPageRequest(config)` | 创建 `PageFetcher` |
| `extractTotal` | 取总数，`null`/`''` 抛错（不静默当 0） |
| `getByPath(raw, path)` | 点号路径取值，支持数组下标 |
| `extractRows` / `extractTotal` | 从响应里取列表 / 总数 |
| `assertServerScope(feature)` | dev 环境提醒数据级权限 |
| `FbkDataError` | 错误类型，带 `kind` 与 `raw` |

类型：`Page` / `PageQuery` / `PageSort` / `PageFetcher` /
`CreatePageRequestConfig` / `DataScope` / `PathSpec` /
`PageRequestErrorEvent`
