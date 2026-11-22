# @fbkworks/adapter-naive-ui

FBK 业务组件库的 Naive UI 适配器（桌面端，DataGrid 渲染为表格）。

```bash
pnpm add @fbkworks/components @fbkworks/adapter-naive-ui
pnpm add -D naive-ui
```

## 使用

```ts
import { createBusinessKit } from '@fbkworks/adapter-core'
import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'

import '@fbkworks/tokens/css'
import '@fbkworks/adapter-naive-ui/style.css'
import '@fbkworks/components/style.css'

createApp(App).use(createBusinessKit({ adapter: naiveUiAdapter }))
```

::: warning 必须经过 FbkProvider
Naive UI 没有可覆盖的 CSS 变量体系，主题必须走 `NConfigProvider`。
只调用 `theme.apply()` 而不包 `<FbkProvider>` 时，暗色不会生效。
`createBusinessKit` 与 `<FbkProvider>` 都会渲染 `adapter.RootProvider`。
:::

## 能力

`theme.provider: true`、`dataGrid.presentation: 'table'`、`dataGrid.virtualScroll: false`。

`theme` 只有 `darkMode` / `provider` 两个字段（`cssVariables` 已从契约移除）。
`dataGrid` 的 `expandable` / `tree` / `virtualScroll` / `stickyHeader` 一律是 `false`：
`DataGridProps` 里没有对应 prop，声明 `true` 会让调用方按能力位分支却传不进去。

## License

MIT
