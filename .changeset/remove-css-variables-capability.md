---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/adapter-vant": minor
---

### 移除 `capabilities.theme.cssVariables`

这条能力位被删除。

**为什么**：

- **零消费者**——审计过业务组件（`packages/components`、`dashboard`、`screen`），没有任何一处读取它
- **语义无法界定**——它想表达的是「能不能用 CSS 变量改主题」，但三个适配器的 `style.css`
  都在用 `var(--fbk-*)`（element-plus 63 次、vant 76 次、**naive-ui 也有 63 次**），
  而 naive-ui 却声明为 `false`。到底指「我们的样式用变量」还是「UI 库内部用 CSS-in-JS 导致变量不穿透」，
  从代码里无法确定
- **无法机械验证**——按「style.css 是否用变量」来查，三家用量相当，判不出 naive 的 `false`

一个既没人读、又说不清含义、也验不了的声明，留着只会误导。

**影响**：如果你读过 `adapter.capabilities.theme.cssVariables`，请改为直接覆盖 `--fbk-*` 令牌
（三个适配器的样式都基于它们），或按具体的 UI 库能力自行判断。

### 顺带：能力位欠债清零

`pnpm check:capabilities`（strict）从「11 条未验证」降到 **0**，并已加入 `pnpm verify`（第 15 步）
与 CI。达成路径里修掉了 4 个真实缺陷，详见 commit c0b551c / ac659e9 / 8aa181e / cdc1de2。
