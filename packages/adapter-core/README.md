# @fbk/adapter-core

FBK 业务组件库的适配器契约层：定义 UI 原语契约、能力声明、注入与主题桥。
业务组件只依赖这个包，不依赖任何具体 UI 库。

```bash
pnpm add @fbk/adapter-core
# 再选一个适配器
pnpm add @fbk/adapter-element-plus   # 或 @fbk/adapter-vant / @fbk/adapter-naive-ui
```

## 使用

```ts
import { createBusinessKit } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'

createApp(App).use(createBusinessKit({ adapter: elementPlusAdapter, theme: 'light' }))
```

局部 / 微前端 / 多适配器共存：

```vue
<FbkProvider :adapter="vantAdapter" theme="dark">
  <OrderList />
</FbkProvider>
```

## 契约

- `UiAdapter`：`meta` / `capabilities` / `primitives` / `RootProvider` / `theme`
- `UiPrimitives`：Button、Input、Select、Form、FormItem、DataGrid、Pagination、Dialog、Tag、Empty、Spin
- `Capabilities`：能力声明，业务组件据此降级而不是判断适配器名字
- `ADAPTER_API_VERSION`：启动时校验，防止 core 与适配器版本错配
- 注入键使用 `Symbol.for('fbk.adapter.context')`，多份 core 副本也不会断

## 写自己的适配器

实现 11 个原语 → 声明能力 → 导出 `UiAdapter` → 跑 `@fbk/adapter-conformance`。
详见文档「编写自定义适配器」。

## License

MIT
