# 主题与暗色模式

## 两层主题

```text
tokens（--fbk-* 变量）
   ↓ 适配器映射
UI 库主题（--el-* 变量 / --van-* 变量 / NConfigProvider theme）
```

业务组件只读 `--fbk-*`。适配器负责把这套令牌翻译成各库认得的形态。

## 两种主题桥

```ts
export interface ThemeBridge {
  /** CSS 变量型：element-plus / vant */
  apply?(mode: ThemeMode, tokens: FbkTokens): void
  /** Provider 型：naive-ui */
  providerProps?(mode: ThemeMode, tokens: FbkTokens): Record<string, unknown>
}
```

| 适配器 | 类型 | 机制 |
|---|---|---|
| element-plus | CSS 变量 | 写 `--el-color-primary` 等，暗色切换 `html.dark` |
| vant | CSS 变量 | 写 `--van-primary-color` 等 |
| naive-ui | Provider | 通过 `NConfigProvider` 的 `theme` + `themeOverrides` |

::: warning naive-ui 必须包 `FbkProvider`
naive-ui 没有可覆盖的 CSS 变量体系。如果你只 `apply()` 而不包 `<FbkProvider>`，暗色会"看起来没生效"。
`FbkProvider` 会把 `adapter.theme.providerProps()` 传给 `adapter.RootProvider`。
:::

## 覆盖令牌

```css
/* 应用侧 */
:root {
  --fbk-color-primary: #7c3aed;
  --fbk-radius-md: 10px;
}
```

适配器在下一次 `apply()` 时读取当前令牌值。若要运行时换肤，调用：

```ts
import { defaultTokens } from '@fbk/tokens'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'

elementPlusAdapter.theme.apply('light', { ...defaultTokens, color: { ...defaultTokens.color, primary: '#7c3aed' } })
```

## 暗色模式

```ts
createBusinessKit({ adapter: elementPlusAdapter, theme: 'dark' })
```

或局部：

```vue
<FbkProvider :adapter="adapter" theme="dark">
  <OrderList />
</FbkProvider>
```

- element-plus：额外引入 `@fbk/adapter-element-plus/dark.css`（内部 `@import 'element-plus/theme-chalk/dark/css-vars.css'`）。
- vant：适配器设置 `van-config-provider` 的 `theme="dark"`。
- naive-ui：`providerProps()` 返回 `{ theme: darkTheme }`。

## 尺寸与状态枚举

契约里的尺寸与状态是与 UI 库无关的语义枚举，适配器负责翻译：

```ts
type Size = 'sm' | 'md' | 'lg'
type Status = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
```

业务代码永远写 `size="sm"`，而不是 `size="small"`（element-plus）或 `size="small"`（naive-ui 实际是 `'small' | 'medium' | 'large'`）。
