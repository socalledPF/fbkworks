# 企业级前端架构：优先级与落地

> 本文是 `docs/design/2026-10-25-*.md` **6 份**设计稿的总览。
> 核心判断：**组件库已够用，真正的瓶颈是契约层、权限、可观测性。**

## 优先级总览

| 级别 | 内容 | 状态 |
|---|---|---|
| P0 | 契约层 `@fbkworks/data` | ✅ 已落地 |
| P1 | 权限三层 | ✅ 已落地（操作级 + 数据级声明） |
| P2 | 可观测性统一出口 | ✅ 已落地 |
| P3 | 工程基建补强 | ✅ 已落地（P3-1 变更影响分析） |
| P4 | 组件库演进 | ✅ P4-1 / P4-2 / P4-3 已落地（P4-2 的文档页待补） |

## 为什么组件库排最后

`apps/admin` 1929 行业务代码里，组件库只覆盖约 400 行。
剩下的是布局、路由、数据层、状态 —— **组件库帮不上忙**。

组件库的价值不在「省几行 HTML」，在**约定**：
- `request` 必须是 `(params) => Promise<{list, total}>`
- 分页/排序/筛选的联动规则固定
- 空态/错误态有统一表现

所以正确方向是**加深约定**，不是加宽覆盖。

---

## P0：契约层 `@fbkworks/data`

### 解决什么

后端改字段（`rows` → `list`）时，5 个页面全崩且编译期发现不了。

### API

```ts
import { createPageRequest } from '@fbkworks/data'

export const fetchOrders = createPageRequest({
  fetch: ({ page, pageSize, params, signal }) =>
    http.get('/api/order/list', { params: { pageNum: page, pageSize, ...params }, signal }),
  rows: 'rows',          // 或 'data.records' / 函数
  total: 'total',
  isSuccess: (res) => res.code === 200,
  errorMessage: (res) => res.msg,
  scope: 'server-filtered',
})
```

业务方只写「字段在哪」。分页、错误处理、类型转换都由契约层做。

### 关键设计

| 决策 | 理由 |
|---|---|
| 路径解析失败**抛错**而非返回空数组 | 静默返回空会让用户看到「暂无数据」，而真实原因是字段名写错 |
| `isSuccess` 不传视为成功 | 但**有业务码的后端必须传**，否则 token 过期会显示成空列表 |
| `AbortSignal` 不吞异常 | `use-table-request` 依赖 `AbortError` 判断是否丢弃响应 |
| 不内置 HTTP | 传输层是应用决策 |

### 实测收益

`apps/admin/src/mock/data.ts`：**294 → 224 行**（mock 后端另拆到 `server.ts`）。

---

## P1：权限三层

| 层 | 谁负责 |
|---|---|
| 路由级 | 应用层（库不做，不该知道路由） |
| 操作级 | `v-permission` + `usePermission()` |
| 数据级 | 库提供**声明能力**，服务端负责执行 |

### 操作级

```vue
<button v-permission="'order:delete'">删除</button>
<button v-permission="['order:edit', 'order:delete']">编辑</button>
```

**关键：无权限时元素从 DOM 移除，不是 `display:none`。**

`display:none` 的按钮仍在 DOM 里，控制台一行 `el.click()` 就能触发。
移除才是「这个操作不存在」。

### 数据级

前端**无法**真正做数据级权限 —— 接口返回 1000 条，前端隐藏 900 条，
那 1000 条依然在 Network 面板里。

所以库只做两件事：
1. 提供显式声明位（`scope: 'server-filtered'`）
2. 写错时在 dev 环境提醒

```ts
scope: 'client-filtered'  // → warn：
// 数据级权限必须由服务端过滤。前端隐藏不构成权限。
```

这条 warn 的价值在于它出现在**写代码的那一刻**。

---

## P2：可观测性

### API

```ts
app.use(createBusinessKit({
  adapter,
  onError: (e) => report(e),        // { source, component, message, stack, context }
  onTelemetry: (e) => track(e),     // { type, name, duration, success, context }
}))
```

### 已接入的上报点

| 位置 | 事件 |
|---|---|
| `use-table-request` 成功/失败 | `ProTable.request` + 耗时 + 参数快照 |
| `FormModal` 提交失败 | `error` / `source: 'component'` |

### 关键设计

- **默认不采集**：未传钩子时是 noop，零开销
- **上下文截断**：大数组只留前 5 项 + 总数，长字符串截断到 200 字符
  —— 避免上报体积失控与数据泄漏
- **上报器自身抛错不影响业务**
- **不用全局单例**：走 provide/inject，多实例安全

---

## 门禁接入

新增 `packages/data` 后，三处门禁同步更新：

- `eslint.config.mjs` 的 `PUBLISHED_PACKAGES`
- `dependency-cruiser.config.mjs` 的 `no-business-runtime-deps`
- `scripts/check-runtime-deps.mjs` 的 `PUBLISHED`

## 验证

- `pnpm verify`（18 步）全绿：**840 通过 + 4 skipped / 74 个测试文件**
- `scripts/visual/verify-admin.py`：**34 项**端到端检查（不在 CI 中，仅手工调用）
  含权限移除验证（DOM 里查不到，不是 `display:none`）、上报事件可达

---

## 尚未做（按决策跳过或延后）

| 项 | 原因 |
|---|---|
| P4-2 详情抽屉的文档页 | 组件已导出、有 demo，`apps/docs/components/` 下缺 `detail-drawer.md` |
| 角色 → 权限点映射 | 那是应用的用户体系，库不该知道 |
| 微前端 / SSR | 中后台不需要，引入成本远大于收益 |
