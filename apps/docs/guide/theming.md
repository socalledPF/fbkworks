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

## 主题预设：cyber（未来科技风）

除了明暗两档，还内置一套风格预设。它不是「第三种明暗」，而是**暗底 + 青色主色**
的完整配色方案：

```ts
import '@fbk/tokens/css'
import '@fbk/tokens/dark.css'
import '@fbk/tokens/cyber.css'   // 新增

createBusinessKit({ adapter: elementPlusAdapter, theme: 'cyber' })
```

或局部切换：

```vue
<FbkProvider :adapter="adapter" theme="cyber">
  <OrderList />
</FbkProvider>
```

`theme: 'cyber'` 会：

1. 把 `data-fbk-theme="cyber"` 写到根元素，命中 `cyber.css` 的选择器；
2. 让适配器改用 `cyberColorOverrides` 注入 UI 库自己的变量
   （element-plus 的 `--el-color-primary`、naive 的 `primaryColor`）。

第 2 步不能省。只引 `cyber.css` 而不传 `theme: 'cyber'`，会得到
「表格是青色、主按钮还是蓝色」的割裂 —— CSS 变量只管 fbk-* 元素，
UI 库内部的组件读的是它们自己的变量。

::: tip 为什么色值在 CSS 和 TS 里各有一份
`cyber.css` 给纯样式消费者（只引 CSS、不走 JS 主题桥）；
`cyberColorOverrides` 给适配器注入 UI 库变量。两份必须一致，
由 `packages/tokens/tests/cyber.spec.ts` 逐字段比对断言保证。
:::

设计取舍：

| 决策 | 原因 |
|---|---|
| 冷黑偏蓝底 `#070b14`，不用纯黑 | 纯黑与发光色相邻会产生晕影，长时间看表格累 |
| 状态色只抬明度、不改色相 | 保住「绿=成功、红=危险」的语义可辨识度 |
| 阴影改成发光 | 暗底上的黑投影几乎不可见 |
| 主按钮文字用深墨色 | 亮青 `#22d3ee` 上白字只有 1.81:1，深墨色 10.65:1 |

所有文字/背景组合按 WCAG AA 核算，30 条对比度断言锁定。

## 尺寸与状态枚举

契约里的尺寸与状态是与 UI 库无关的语义枚举，适配器负责翻译：

```ts
type Size = 'sm' | 'md' | 'lg'
type Status = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
```

业务代码永远写 `size="sm"`，而不是 `size="small"`（element-plus）或 `size="small"`（naive-ui 实际是 `'small' | 'medium' | 'large'`）。
