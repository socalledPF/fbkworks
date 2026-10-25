---
"@fbk/data": minor
"@fbk/components": minor
---

feat(data): 新增契约层 `@fbk/data`，分页契约收敛为单一定义处

### 新增

`createPageRequest` 把任意形状的后端响应映射成 `Page<T>`，业务方只写
「字段在哪」。支持点号路径（含数组下标）、业务码判定、行映射、
数据级权限声明、错误上报钩子。

### 行为变化

- **`@fbk/components` 的分页契约改为 `@fbk/data` 的别名**：
  `TableRequestParams` = `PageQuery`、`TableResponse` = 放宽 total 的 `Page`、
  `TableRequest` 结构不变。现有调用零改动，但类型定义的来源变了。
- 之前的「两处同形接口 + 注释声称兼容」改为编译期断言
  （`packages/components/tests/contract-compat.spec.ts`）。任何人改动
  `@fbk/data` 的分页契约，components 侧会立刻编译失败。
- `createPageRequest` 新增 `onError` / `feature` 配置，用于错误上报。
  `AbortError` 不上报（取消不是错误）。
