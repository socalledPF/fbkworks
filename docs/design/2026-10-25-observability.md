# 设计稿：可观测性统一出口

> 企业级前端架构优先级计划的 P2。成本最低，但一旦有了后面所有监控都能接上。

## 一、问题

现在组件库的失败路径**各写各的**：

| 位置 | 现状 |
|---|---|
| `use-table-request.ts` | `catch` 里设置 `error.value`，然后调 `options.onError` |
| `ProTable` | 有 `onError` prop，但只是转发 |
| `FormModal` | emit `error` 事件 |
| 渲染错误 | 无人接管 |

**结果是：每个业务方都要自己接一遍**，而且接法都不一样。更糟的是
**默认什么都不采集** —— 上线后报错了，没人知道。

## 二、设计

### 2.1 两个可选钩子（挂在 BusinessKitOptions）

```ts
export interface BusinessKitOptions {
  // ... 现有
  /** 统一错误出口。不传则不采集（零开销） */
  onError?: (event: FbkErrorEvent) => void
  /** 统一行为与性能事件出口。不传则不采集 */
  onTelemetry?: (event: FbkTelemetryEvent) => void
}
```

**关键约束：默认不采集。** 未传钩子时零开销、零上报 ——
组件库不该替业务方决定往哪报数据。

### 2.2 事件形状

```ts
export interface FbkErrorEvent {
  /** 错误来源 */
  source: 'component' | 'request' | 'render'
  /** 组件名，如 'FbkProTable' */
  component?: string
  message: string
  stack?: string
  /** 上下文：请求参数、行数据等。**由库截断，避免把大对象带出去** */
  context?: Record<string, unknown>
}

export interface FbkTelemetryEvent {
  type: 'request' | 'interaction'
  /** 事件名，如 'ProTable.request' */
  name: string
  /** 耗时（ms），仅 request 类 */
  duration?: number
  success?: boolean
  context?: Record<string, unknown>
}
```

### 2.3 接入点

| 接入点 | 事件 | 说明 |
|---|---|---|
| `use-table-request` 成功 | `request` / `duration` / `success: true` | 表格请求耗时 |
| `use-table-request` 失败 | `error` / `source: 'request'` | 含 `params` 快照 |
| `FormModal` 提交失败 | `error` / `source: 'component'` | 含 `mode` |
| `app.config.errorHandler` | `error` / `source: 'render'` | `createBusinessKit` 里挂 |

### 2.4 上下文截断

`context` 必须截断 —— 否则一个含 500 行的表格数据被塞进上报，
既慢又可能泄漏数据。

```ts
function safeContext(input: Record<string, unknown>): Record<string, unknown> {
  // 只保留原始值与短数组/短字符串，其余替换为类型摘要
}
```

### 2.5 实现方式：注入而非全局单例

不用全局单例（`setTelemetry()` 那种），因为：
- 全局单例在 SSR / 多实例场景会串数据
- 通过 `provide/inject` 走 adapter context，天然多实例安全

```ts
// 组件内
const reporter = useReporter()  // 内部 hook，读 context
reporter.error({ source: 'request', ... })
reporter.telemetry({ type: 'request', ... })
```

未配置时 `reporter` 是空实现（noop），不产生任何开销。

## 三、验收

| 项 | 标准 |
|---|---|
| 默认零开销 | 不传钩子时，组件行为与现在完全一致 |
| 四类事件可达 | 请求成功/失败、表单失败、渲染错误 |
| 上下文截断 | 大数组被替换为摘要，不原样上报 |
| 多实例安全 | 两个 Provider 各自独立的 reporter |
| 单测 | noop 分支、截断逻辑、四类事件触发 |

## 四、不做

| 不做 | 理由 |
|---|---|
| 内置上报后端 | 库不该知道 Sentry / 阿里云 ARMS |
| 自动采集性能指标 | 与业务强相关，应由应用层决定采什么 |
| 全局单例配置 | 多实例会串数据 |
