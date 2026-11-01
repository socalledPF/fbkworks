---
"@fbkworks/adapter-element-plus": patch
"@fbkworks/adapter-naive-ui": patch
---

收回四个从未实现的能力声明

`dataGrid` 的 `expandable` / `tree` / `stickyHeader`（element-plus 与 naive-ui）
以及 `virtualScroll`（naive-ui）此前声明为 `true`，但 `DataGridProps` 里
**根本没有对应 prop** —— 也就是说它们不只是没实现，连请求的入口都不存在。

调用方按能力位分支（`if (capabilities.dataGrid.tree) { ... }`）会以为传树形数据
能工作，实际拿到的是一张平铺的表，且没有任何警告。

现在如实声明为 `false`。要真正支持，需要先在 `DataGridProps` 加 prop、
三个适配器各实现、再补一致性用例 —— 那是一轮独立设计，不是一个布尔值的改动。

### 顺带：能力位与实现的绑定校验

新增 `packages/internal/adapter-conformance/tests/capability-coverage.spec.ts`：
要求**每一个「真值」能力位都交代由谁验证** —— 一致性用例（`@capability` 标记）、
静态成员判定、或显式登记为 `unverified` 欠债。

它随 `pnpm test` 运行，所以以后新增能力位却没人验证会直接红。
`pnpm check:capabilities` 是 strict 模式（`unverified` 也算失败），
用于发版前强制还债 —— 当前还有 11 条已登记的欠债。
