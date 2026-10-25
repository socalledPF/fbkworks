---
"@fbk/data": minor
---

feat(data): 新增 `defineBackend`，后端惯例只写一次

### 问题

一个项目通常只有 1-2 种响应形状，但 `createPageRequest` 要求每个
列表接口重复描述 `rows` / `total` / `isSuccess` / `errorMessage`。
12 个接口 × 6 行 = 72 行，其中 60 行是纯重复。

### 解法

```ts
// src/api/backend.ts —— 全项目唯一一处
export const api = defineBackend({
  request: (url, params, signal) => http.get(url, { params, signal }).then((r) => r.data),
  rows: 'content',
  total: 'totalElements',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  mapParams: ({ page, pageSize, params }) => ({ pageNum: page, pageSize, ...params }),
})

// src/api/order.ts —— 每个接口只剩自己的信息
export const fetchOrders = api.page('/api/order/list', { feature: 'order.list' })
```

### 两种形态

- **A** 传路径：`api.page('/api/orders')`，用后端惯例的 `request`
- **B** 传 fetcher：`api.page(({ page, signal }) => http.get(...))`，逃生口

B 形态只接管「怎么发请求」，解析仍用后端配置。

### 兼容

`createPageRequest` 完全不变，`defineBackend` 是叠加的层。
内部也复用它 —— 错误上报、路径解析、AbortError 不吞等行为自动继承，
不存在两套实现漂移。
