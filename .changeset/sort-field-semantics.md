---
"@fbk/adapter-core": patch
"@fbk/adapter-element-plus": patch
"@fbk/adapter-naive-ui": minor
"@fbk/adapter-vant": minor
---

统一 `update:sort` 的字段语义，修正 `vant` 的排序能力声明

### ⚠️ `@fbk/adapter-naive-ui` 的行为变化（可能破坏现有消费方）

`update:sort` 的 `field` 此前在两个桌面适配器上取自**不同的来源**：

| 适配器 | 改前 `field` | 改后 `field` |
|---|---|---|
| element-plus | `column.dataIndex`（缺省时**emit null**） | `column.dataIndex ?? column.key` |
| naive-ui | `column.key` | `column.dataIndex ?? column.key` |

`key ≠ dataIndex` 时（`key` 用作行标识、`dataIndex` 对应后端字段），两家会把
**不同的字符串**发给后端——同一个页面换适配器，排序参数就变了。

现在一律取 `dataIndex`，缺省回退 `key`。**依赖「field 等于 column.key」的
naive-ui 消费方需要检查**：若你的列定义了 `dataIndex` 且与 `key` 不同，
现在发给后端的是 `dataIndex`。

顺带修掉一个更严重的问题：element-plus 在 `dataIndex` 缺省时**不回退**，
`prop` 为 undefined 导致 el-table 回传空字段，适配器判空后 **emit 的是 null**
——点击可排序列表头什么都收不到。现在两家都正确回退。

### `vant` 的排序能力位

`capabilities.dataGrid.sort` 由 `'custom'` 改为 `'none'`。卡片列表没有表头，
全文也没有一处 `emit('update:sort')`——声明与实现是断开的。补齐移动端排序入口
（下拉 / 筛选栏 / 顶栏菜单）需要产品方案，在那之前用能力位如实声明。

契约测试同步：`skip: ['sort']` 保留，被跳过的契约项在输出里以 `skipped` 出现，
而不是让用例无声消失。

### 测试基座

`mock-adapter` 此前同样声明了 `sort: 'custom'` 却从不 emit `update:sort`，
导致 `ProTable` 的排序链路（含「排序后回到第 1 页」这条业务规则）
在组件测试里**一次也执行不到**。现在 mock 会渲染表头与排序控件、
按契约发出三态 `update:sort`，该规则已被测试覆盖。
