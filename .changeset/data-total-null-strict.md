---
"@fbk/data": patch
---

fix(data): `total` 为 null / 空字符串时抛错，不再静默当成 0

### 行为变化（需要关注）

`Number(null) === 0`、`Number('') === 0` —— 之前 `extractTotal` 会把
`total: null` 静默转成 0。

后果：后端返回 `total: null`（「暂无数据」或字段未初始化时很常见）时，
分页器显示「共 0 条」，而实际可能有数据。用户看到的是错误信息，
且没有任何报错，排查成本很高。

现在抛 `FbkDataError`，消息里解释原因并给出替代方案
（`total: (raw) => rows.length` 或直接不传 `total`）。

### 如果确实可能没有 total

```ts
// 方案一：用列表长度兜底
createPageRequest({ fetch, rows: 'rows', total: (raw) => raw.rows.length })

// 方案二：不传 total（默认用 rows.length）
createPageRequest({ fetch, rows: 'rows' })
```
