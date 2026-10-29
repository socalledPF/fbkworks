---
"@fbkworks/adapter-core": minor
"@fbkworks/tokens": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/adapter-vant": minor
---

让 `size` 与自定义 `tokens` 真正生效

### `size` 此前在两个适配器上是空转

`ctx.size` 一直被 watch、也传给了 RootProvider，但三个适配器里只有 element-plus
真正消费它（映射到 `ElConfigProvider` 的 `size`）。naive-ui 与 vant 只声明了
prop 而不读取——改 `size` 不会让任何控件变大变小。

两个库都没有 `size` 能力（读了类型定义确认：`NConfigProvider` 的 props 里没有
`size`，vant 的 `ConfigProvider` 也没有），所以各自走自己的中枢：

- **naive-ui** → `themeOverrides.common.heightSmall/Medium/Large`
  （实测写成控件行内的 `--n-height`，控件 CSS 读的就是它）
- **vant** → `themeVars` 注入 `--van-*`（provider 元素上的行内变量，子树继承）

两者与 element-plus 共用同一套比例尺 `{ sm: 0.75, md: 1, lg: 1.25 }`，
md 基准 = element-plus 默认控件 32px，三档控件高度在 sm/md/lg 下均为
**24 / 32 / 40px**，逐像素对齐。

`md` 是默认档且与引入 `size` 之前完全一致：vant 在 md 下**不注入**任何变量
（注入即把库默认值钉死），naive 的 md 阶梯仍是原有的 28/32/40。

### `toCssVars()` 此前零消费者

`createBusinessKit({ tokens })` 注入的自定义令牌到不了任何 CSS 变量，
组件样式表读的仍是 `tokens.css` 的编译值。

现在新增 `toCssText()`（纯函数，只产出文本不碰 DOM），由 adapter-core 注入单个
`<style id="fbk-custom-tokens">`：

- **不用行内变量**（`style.setProperty`）。行内变量会无条件压过 `dark.css` /
  `cyber.css` 的 `html[data-fbk-theme]` 规则，主题切换直接失效——这是
  checkpoint §6.7 记过的坑。写 `<style>` 则与其它 CSS 同源：
  基础令牌与 `tokens.css` 同为 `:root`，靠文档顺序取胜；主题覆盖的属性选择器
  特异性更高，仍然胜出。
- **只在显式传了 `tokens` 时注入**：默认令牌已编译进 CSS，重复注入只是多一份
  与主题同特异性竞争的声明。
- 固定 id + 复用同一元素：重复 install / 多个 Provider 只有一个 `<style>`。
  生命周期跟随 `app.onUnmount` 与 Provider 的 `onUnmounted`。
- SSR（无 `document`）不入栈，避免模块级状态按请求堆积。

> 验证说明：jsdom 不实现 CSS 特异性（只按文档顺序取胜者），因此「主题仍然胜出」
> 无法用 jsdom 的 `getComputedStyle` 证明。除按级联规范求解外，另用真实 Chromium
> 实测：浅色下自定义令牌生效、`data-fbk-theme=dark` 后 dark.css 的值胜出、
> 与主题无关的令牌仍是自定义值。
