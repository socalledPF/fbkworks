---
"@fbkworks/schema": minor
---

新增 `@fbkworks/schema`：一份字段定义派生 query / column / form 三份视图。

- `defineFields` 声明定义并保留 `type` 的字面量类型；
- `toQueryFields` / `toColumns` / `toFormFields` 三个派生器，纯函数、零依赖、不引 vue；
- `views` 缺省 = 三个视图都出现，显式给出则只出现在列出的视图里；视图自己的键覆盖通用键；
- 派生结果是新对象，改派生结果不会污染原定义。

新包，未进 changesets 的 `fixed` 组：fixed 组是 8 个按同一个版本号发布的组件族包，
L1 纯逻辑包（`shared` / `tokens` / `data` / `resolver`）一直独立发版，schema 同属 L1。
