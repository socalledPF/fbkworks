---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-vant": minor
"@fbkworks/adapter-naive-ui": minor
---

### BREAKING：移除 `Empty` 原语

`UiPrimitives.Empty`、`EmptyProps` 与三个适配器导出的 `Empty` 组件已删除。

**为什么**：它是唯一一个「零消费者」的必填原语。

- 业务组件里访问 `adapter.primitives.Empty` 的地方：**0 处**
- `DataGridProps` 只有 `emptyText?: string`，**没有 `empty` 插槽**，所以业务层无法注入它
- 三个适配器的 `DataGrid` 直接 import 自家 UI 库的空态组件
  （element-plus 用 `ElTable` 自带的空态、naive-ui 用 `NEmpty`、vant 用 `VanEmpty`）

也就是说它声明在公共契约里，但两头都够不着：业务层没有入口，适配器层不需要它（用自己的 DataGrid 调自己提供的 Empty 是自引用）。

**影响**：如果你在业务代码里用过 `adapter.primitives.Empty` 或从适配器包 import 过 `Empty`，
请改用 UI 库自身的空态组件。适配器的 `DataGrid` 空态行为**不变**（它本来就不走这个原语）。

**不升 `ADAPTER_API_VERSION`**：移除必填项向后兼容 —— `assertAdapterCompatible` 只做超集检查
（`required` 里的键都必须存在），多出来的 `Empty` 会被忽略。按旧的 v3 写的适配器继续可用。

> 这也印证了一条判据：**新增原语会破版（旧适配器缺成员），移除原语不会。**
> 所以「新增」该走特性层，「移除」不需要动版本号。

### 顺带

`FbkProTable` 目前**无法自定义空态**，只能改文案 —— 因为契约里没有 `empty` 插槽。
这是独立于本条的一个产品缺口，留待单独评估。
