---
"@fbk/shared": minor
---

fix(L1): 行 key 回退值加命名空间，格式化支持 locale，缓存键稳定化

### 行为变化（需要关注）

`getRowKey` 在行缺主键时不再回退为裸的 `index`，改为
`__fbk_row_index__<index>` 并 `warnOnce` 提示。

旧实现有一个真实的数据错误：回退值与合法主键同域，
`rows = [{}, { id: 0 }]` 会产出两个 `0` —— 勾选一行同时勾中另一行，
`v-for :key` 重复还会让 DOM 被复用错乱。`0` 是合法主键（自增从 0 起、
枚举值 0），不能被 `??` 之后的逻辑当成"空"。

**如果你把数字型 index 存进过 `selectedKeys`**（仅在 `rowKey` 指向的字段
缺失时才会发生），升级后这些选中项会失效，需要改为使用稳定主键。
正常配置了主键的数据不受影响。

### 新增能力

- `formatNumber` / `formatMoney` / `formatDate` 增加 `locale` 参数（默认 `'zh-CN'`）。
  此前 locale 被硬编码，`createBusinessKit({ locale })` 与 `useFbkTheme().locale`
  对格式化毫无影响 —— 设成 `en-US` 后金额与日期仍是中文格式。
  L1 保持纯函数层，不读注入上下文；由 ProTable 从 `useFbkTheme().locale` 取到后显式传入。
- 导出 `DEFAULT_LOCALE` 与 `ResponsiveColumns` 类型。

### 修复

- `formatNumber` 的 formatter 缓存键按字母序排序后再序列化：
  语义相同但书写顺序不同的 `options` 现在稳定命中同一条目。
- 缓存加上 50 条上限。SSR 下这是模块级状态，此前无界增长。
- `formatDate` 对布尔值等非日期输入原样返回，不再渲染成 `1970-01-01`。
- `formatDate` 的 `zh-CN` 输出保持 `YYYY-MM-DD HH:mm` 手工拼接，未改用
  `Intl.DateTimeFormat` —— 后者在 zh-CN 下输出斜杠分隔，会让所有既有页面的
  日期列观感改变。

### 测试

`@fbk/shared` 的导出从"14 个里只有 1 个有测试"补齐为全部覆盖，
新增 58 个用例（format / keys / utils / warn / controllable / locale 端到端）。
