---
"@fbkworks/components": patch
---

fix(components): `DetailPage` 补齐 `Descriptions` 的属性透传

### 问题

`DetailPage` 的 `items` 复用了 `DescriptionItem`，但只透传了
`column` / `groups` / `emptyText`，漏了 `bordered` / `direction` / `size`。

表现为：demo 里写 `<FbkDetailPage bordered>` 完全没有边框，
而同样的 `bordered` 在 `FbkDescriptions` 上是有效的 ——
业务方会以为「DetailPage 不支持边框」，只能用 `extra` 插槽自己拼。

### 修复

补齐三项透传。判断标准：**既然 items 复用 DescriptionItem，
影响「字段怎么显示」的开关也应该能透传。**

### 顺带

`CrudPage` 的 `useSlots()` 在 dts 构建阶段报 TS7022（隐式 any）——
这个错误只在 build 时出现，typecheck 看不到，之前 `docs:build`
一直有这个噪音。已显式标注类型。
