# @fbk/shared

FBK 业务组件库的无 UI 语义工具层（L1）。不依赖任何 UI 库，也不依赖 Vue 之外的运行时。

L1 是**纯函数层**：不读注入上下文、不感知主题与 locale 设置。需要随语言变化的格式化，
由调用方（L2/L4）把 locale 显式传进来。

```bash
pnpm add @fbk/shared
```

## 内容

| 导出 | 说明 |
|---|---|
| `useControllableState` | "存在即受控"的受控/非受控状态 |
| `getRowKey` / `toKeySet` | 行 key 解析与集合化 |
| `mergeUiProps` | 合并 `uiProps` 逃生舱，带 deny-list |
| `formatNumber` / `formatMoney` / `formatDate` | 基于 `Intl`，可指定 locale，不依赖 dayjs |
| `resolveColumns` | 响应式列数 → `--fbk-cols-*` CSS 变量 |
| `toCssSize` / `pickDefined` / `isNil` | 小工具 |
| `warn` / `warnOnce` | 开发期告警，同一 key 只提示一次 |

```ts
import { formatMoney, getRowKey, useControllableState } from '@fbk/shared'

// 金额：默认 zh-CN，不输出货币符号
formatMoney(1234.5)            // '1,234.50'
formatMoney(1234.5, 2, 'de-DE') // '1.234,50'

// 行 key：缺主键时回退到带命名空间的位置索引，不会与合法主键（含 0）相撞
getRowKey({ id: 0 }, 0, 'id')  // 0
getRowKey({}, 3, 'id')         // '__fbk_row_index__3'（并 warnOnce）

// 受控/非受控：传值即受控，不传则用内部状态
const [value, setValue] = useControllableState({
  value: () => props.modelValue,
  defaultValue: '',
  onChange: (v) => emit('update:modelValue', v),
})
```

## 行为约定

- **`formatNumber` / `formatMoney` 的缓存**对语义相同的 `options` 稳定命中（键会排序），
  并限制在 50 条以内 —— SSR 下这是模块级状态，必须有界。
- **`formatDate` 的 zh-CN 输出固定为 `YYYY-MM-DD[ HH:mm]`**，不走 `Intl.DateTimeFormat`：
  Intl 在 zh-CN 下是斜杠分隔，换掉会改变所有既有页面的日期观感。
  其他 locale 交给 Intl 按该语言惯例排版。
- **布尔值等非日期输入原样返回**，不转成 `1970-01-01`。

## License

MIT
