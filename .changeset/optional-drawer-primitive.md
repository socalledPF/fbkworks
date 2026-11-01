---
"@fbkworks/adapter-core": minor
"@fbkworks/components": minor
---

### `Drawer` 原语改为可选

`UiPrimitives.Drawer` 从必填变为 `Drawer?: Component`，`assertAdapterCompatible` 不再要求它。

**为什么**：`ADAPTER_API_VERSION` 每加一个原语就破一次版（v2 为 DatePicker/Radio、v3 为 Drawer），
升完所有旧适配器启动即抛错。根因是版本号同时管「改坏已有」和「新增有无」——
前者该管，后者不该。

`Drawer` 是唯一满足「缺了仍有官方完整替代」的原语：需求是「看一条记录的详情」，
`FbkDetailPage` 是同一需求的另一种呈现，且已文档化。其余 13 个原语缺了都只能是降级。

### 缺失时的行为

新增 `requirePrimitive(adapter, key, alternative)`：取可选原语，缺失时抛出**带替代方案**的错误。

`FbkDetailDrawer` 在 mount 阶段报错：

```
[fbk] 适配器「xxx」没有提供 Drawer 原语，该组件不可用。可改用 FbkDetailPage，以整页形式展示同样的内容。
```

**这不是降级**。降级是「看起来能用、行为不同」；报错是「明确告诉你用不了，并给出出路」。

### 没有升 `ADAPTER_API_VERSION`

保持 3。把必填改为可选是**更宽松**的约束：已有 v3 适配器仍然通过，之前不被允许的（无 Drawer）现在通过。
没有任何适配器因这次改动而失败。

由此确立判据：**新增原语会破版（旧适配器缺成员），减少约束不会。** 所以「新增」应走可选层。

### 一致性套件

- 新增断言：`capabilities.overlay.supportsDrawer` 必须与 `primitives.Drawer` 的存在性**恒等**（避免两个真相源）
- 无 Drawer 时整个 Drawer 块标记为 **skipped**（不是失败，也不是无声消失）

### 迁移

**第三方适配器无需改动。** 若不需要抽屉，可去掉 `Drawer` 并把 `overlay.supportsDrawer` 设为 `false`。

若你在代码里直接读过 `adapter.primitives.Drawer`，现在它是 `Component | undefined`，
请改用 `requirePrimitive` 或自行判空。
