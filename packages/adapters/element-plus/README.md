# @fbkworks/adapter-element-plus

FBK 业务组件库的 Element Plus 适配器（桌面端，DataGrid 渲染为表格）。

```bash
pnpm add @fbkworks/components @fbkworks/adapter-element-plus
pnpm add -D element-plus
```

## 使用

```ts
import { createBusinessKit } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'

import '@fbkworks/tokens/css'
import '@fbkworks/adapter-element-plus/style.css'
import '@fbkworks/components/style.css'
import 'element-plus/dist/index.css'

createApp(App).use(createBusinessKit({ adapter: elementPlusAdapter }))
```

暗色模式额外引入：

```ts
import '@fbkworks/adapter-element-plus/dark.css'
```

## 能力

`dataGrid.presentation: 'table'`、`pagination.mode: 'pages'`、`theme.darkMode: true`、`theme.provider: false`。

`theme` 只有 `darkMode` / `provider` 两个字段（`cssVariables` 已从契约移除）；
本适配器走 CSS 变量，暗色由 `html.dark` + `dark.css` 生效，没有 provider 型入口。
`dataGrid` 的 `expandable` / `tree` / `virtualScroll` / `stickyHeader` 一律是 `false`：
`DataGridProps` 里没有对应 prop，声明 `true` 会让调用方按能力位分支却传不进去。

## License

MIT
