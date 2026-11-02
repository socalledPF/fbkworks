---
"@fbkworks/tokens": minor
"@fbkworks/shared": minor
"@fbkworks/data": minor
"@fbkworks/resolver": minor
---

首次公开发布：版本号与 UI 栈对齐到 0.3.0

这四个包本次没有代码变更。写这条 changeset 的唯一目的是让**第一次**发布时
所有包同号，避免「kit 说是 0.3.0，tokens 却是 0.2.0」这种首发噪音。

**这是一次性的，不是常设耦合。** 从 0.4.0 起它们各自独立演进：

- 补丁级修复只发受影响的包（`workspace:^` 的 `^0.3.0` 范围不会因此失效）
- 破坏性变更仍会牵动下游，由 changesets 的 `updateInternalDependencies: "patch"`
  自动把下游的 patch 版本带起来

见 `.changeset/config.json` 的 `fixed` 组：现在只剩 8 个 UI 栈包锁步
（adapter-core / chart-core / 三个适配器 / components / dashboard / screen）。
tokens、shared、data、resolver 已不在其中。
