# 可观测性

统一的错误与行为上报出口。**默认不采集** —— 未传钩子时零开销。

## 接入

```ts
app.use(createBusinessKit({
  adapter,
  onError: (event) => reporter.error(event),
  onTelemetry: (event) => reporter.telemetry(event),
}))
```

或用 `<FbkProvider>`：

```vue
<FbkProvider :adapter="adapter" :on-error="onError" :on-telemetry="onTelemetry">
```

## 事件形状

```ts
interface FbkErrorEvent {
  source: 'component' | 'request' | 'render'
  component?: string        // 'FbkProTable'
  message: string
  stack?: string
  context?: Record<string, unknown>   // 已截断
}

interface FbkTelemetryEvent {
  type: 'request' | 'interaction'
  name: string              // 'ProTable.request'
  duration?: number         // ms
  success?: boolean
  context?: Record<string, unknown>
}
```

## 已接入的上报点

| 位置 | 事件 |
|---|---|
| `use-table-request` 成功 | `ProTable.request` + 耗时 + 行数 |
| `use-table-request` 失败 | `error` / `source: 'request'` |
| `FormModal` 提交失败 | `error` / `source: 'component'` |
| `FbkChart` 初始化/渲染失败 | `error` 事件（不冒泡到全局） |
| `createPageRequest` 失败 | 通过它自己的 `onError` 钩子 |

## 上下文会被截断

大数组只保留前 5 项加总数，长字符串截断到 200 字符，
大对象只保留前 20 个 key。

原因：一个含 500 行的表格数据被塞进上报，既慢又可能把敏感数据
带到第三方平台。

## 设计取舍

| 决策 | 理由 |
|---|---|
| 默认不采集 | 组件库不该替业务方决定往哪报数据 |
| 上报器自身抛错不影响业务 | 监控代码不能把业务搞崩 |
| 走 provide/inject 而非全局单例 | 多实例场景不会串数据 |
| 不内置上报后端 | 库不该知道 Sentry / ARMS |

## 图表侧

`FbkChart` 的 `init` 与 `setOption` 都有保护：失败时组件降级为空态，
通过 `error` 事件上报，**不会让整页白屏**。

```vue
<FbkChart :option="option" @error="onChartError" />
```

`dashboard` 的三个图表组件会把这个事件透传出来。
