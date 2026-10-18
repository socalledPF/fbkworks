# @fbk/adapter-vant

FBK 业务组件库的 Vant 4 适配器（移动端）。DataGrid 没有对应的 Vant 组件，
因此渲染为卡片列表：`column.mobile.primary` 成为标题，其余字段按 `mobile.order` 排列，
分页走 `van-list` 触底加载。

```bash
pnpm add @fbk/components @fbk/adapter-vant
pnpm add -D vant
```

## 使用

```ts
import { createBusinessKit } from '@fbk/adapter-core'
import { vantAdapter } from '@fbk/adapter-vant'

import '@fbk/tokens/css'
import '@fbk/adapter-vant/style.css'
import '@fbk/components/style.css'
import 'vant/lib/index.css'

createApp(App).use(createBusinessKit({ adapter: vantAdapter }))
```

## 适配要点

- `Select` = `van-field` 只读展示 + `van-popup` + `van-picker`（多选为 `van-checkbox-group`）
- `Form.validate()` 用 `@submit` / `@failed` 事件桥接成 `Promise<true>`
- `pagination.mode: 'infinite'`

## License

MIT
