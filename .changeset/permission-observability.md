---
"@fbkworks/adapter-core": minor
---

feat(adapter-core): 新增权限指令与可观测性出口

### 权限

- `v-permission` 指令 + `usePermission()`：操作级权限。
  **无权限时元素从 DOM 移除，不是 `display:none`** ——
  `display:none` 的元素仍在 DOM，控制台一行 `el.click()` 就能触发。
- `createBusinessKit({ permissions })` / `<FbkProvider :permissions>` 提供权限点。

### 可观测性

- `onError` / `onTelemetry` 统一出口，默认不采集（零开销）。
- 上下文自动截断（数组留 5 项、字符串 200 字符），避免上报体积失控与数据泄漏。
- 上报器自身抛错不影响业务。

### 修复

`<FbkProvider>` 此前没有注册 `v-permission` 指令，用 Provider 而非
`app.use(createBusinessKit())` 时模板会报 `Failed to resolve directive`
且静默失效。
