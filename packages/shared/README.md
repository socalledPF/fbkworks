# @fbk/shared

FBK 业务组件库的无 UI 语义工具层。不依赖任何 UI 库，也不依赖 Vue 之外的运行时。

```bash
pnpm add @fbk/shared
```

## 内容

| 导出 | 说明 |
|---|---|
| `useControllableState` | "存在即受控"的受控/非受控状态 |
| `getRowKey` / `toKeySet` | 行 key 解析与集合化 |
| `mergeUiProps` | 合并 `uiProps` 逃生舱，带 deny-list |
| `formatMoney` / `formatDate` / `formatNumber` | 基于 `Intl`，不依赖 dayjs |
| `toCssSize` / `pickDefined` / `isNil` | 小工具 |
| `warn` / `warnOnce` | 开发期告警，生产构建可摇掉 |

```ts
import { useControllableState, formatMoney } from '@fbk/shared'

const [value, setValue] = useControllableState(() => props.modelValue, (v) => emit('update:modelValue', v))
formatMoney(1234.5) // ¥1,234.50
```

## License

MIT
