# 编写自定义适配器

接入第四个 UI 库（例如 Ant Design Vue 或 Arco）时，不需要改任何业务组件。

## 1. 实现原语

契约要求 12 个原语：

```ts
interface UiPrimitives {
  Button: Component
  Input: Component
  Select: Component
  Checkbox: Component
  Form: Component
  FormItem: Component
  DataGrid: Component
  Pagination: Component
  Dialog: Component
  Tag: Component
  Spin: Component
}
```

每个原语的 props 见 `@fbkworks/adapter-core` 的 `contracts/primitives.ts`。
关键约定：

- 受控一律用 `modelValue` + `update:modelValue`；
- 选择器接收 `options` 数组，**不接收子组件**；
- `Checkbox` 承载表单里的布尔字段（`switch` / `checkbox`），`modelValue` 是布尔值；
  不提供它业务组件就只能渲染原生 `<input>`，等于绕过适配层；
- 所有包装器 `inheritAttrs: false` + `v-bind="$attrs"` + `v-slots="slots"`；
- 语义枚举 `Size = 'sm' | 'md' | 'lg'`、`Status = 'default' | 'primary' | ...`。

## 2. 声明能力

```ts
export const arcoCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'table',
    selection: true,
    sort: 'custom',
    expandable: true,
    tree: false,
    virtualScroll: true,
    stickyHeader: true,
  },
  form: { layout: 'horizontal', labelWidth: true, validateOn: ['change', 'blur', 'submit'], asyncValidator: true },
  overlay: { kind: 'dialog', supportsDrawer: true, supportsTeleport: true },
  pagination: { mode: 'pages', pageSizes: true, jumper: true },
  feedback: { message: true, notification: true, confirm: true, loading: true },
  theme: { darkMode: true, cssVariables: false, provider: true },
  features: {},
}
```

**如实声明**。把不支持的能力写成 `true` 只会让业务组件在运行时崩在别处。

## 3. 导出 UiAdapter

```ts
export const arcoAdapter: UiAdapter = {
  meta: {
    apiVersion: ADAPTER_API_VERSION,
    name: 'arco',
    version: '0.1.0',
    uiLibrary: { name: '@arco-design/web-vue', version: '^2.57.0' },
    platform: 'desktop',
  },
  capabilities: arcoCapabilities,
  primitives: { Button, Input, Select, Checkbox, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Spin },
  RootProvider,
  theme: arcoTheme,
}
```

## 4. 跑契约测试

这是接入成本最低、收益最高的一步：

```ts
// packages/adapters/arco/tests/conformance.spec.ts
import { runAdapterConformance } from '@fbkworks/adapter-conformance'
import { mountWithProvider } from '@fbkworks/test-utils'
import { arcoAdapter } from '../src'

runAdapterConformance({
  adapter: arcoAdapter,
  mount: (component, props) =>
    mountWithProvider(component, { adapter: arcoAdapter, props }),
  selectors: {
    row: '.arco-table-tr',
    selection: '.arco-table-checkbox',
    nextPage: '.arco-pagination-item-next',
  },
})
```

套件覆盖 **23 条断言**：`apiVersion` 兼容、能力合法、Button 事件与 attrs 透传、Input v-model、
Checkbox 布尔值、Form `validate()`、DataGrid 渲染与事件、选择/排序、`presentation=cards`、
主题桥幂等，以及 **Drawer**（打开渲染 title 与默认插槽、关闭控件发出 `update:modelValue(false)`、
`placement` 方位、`closeOnClickModal` 正反两向）。

> `Drawer` 是契约版本 3 起的**必填**原语。缺它会直接被 `assertAdapterCompatible` 拦下 ——
> 这是有意的：可选意味着组件层要准备降级路径，而每种降级都是「用户以为能用、实际表现不同」。

跑通它，业务组件基本就能在这个库上正常工作。

## 5. 常见坑

| 坑 | 表现 | 处理 |
|---|---|---|
| 用 `v-model:show` 而不是 `modelValue` | Dialog 打不开 | 在适配器内部转换，契约只认 `modelValue` |
| 表格渲染是异步的 | jsdom 里取不到单元格文本 | 测试里 `await flushPromises()` |
| 选择事件不回传整行 | 拿不到 row | 适配器内部用 rowKey 反查 |
| 直接 import 另一个适配器的工具 | 依赖混乱 | 通用逻辑放 `@fbkworks/shared` |
| 主题只能走 provider | 暗色不生效 | 实现 `theme.providerProps()`，并确认 `RootProvider` 渲染了它 |

## 6. 不要做的事

- 不要在适配器里 import `@fbkworks/components`（反向依赖）。
- 不要把 UI 库的 props 类型暴露到契约里（`uiProps` 是 `Record<string, any>`）。
- 不要试图让三个库像素一致。平台差异是特性，不是 bug。
