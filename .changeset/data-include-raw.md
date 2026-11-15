---
"@fbkworks/data": minor
---

### 错误事件默认不再收集完整响应（`raw`），改为给截断预览

`PageRequestErrorEvent.raw` 的注释一直写的是「原始响应（**截断后**）」，但实现从不截断 ——
事件通常又直接进监控（`onError: (e) => reporter.error(e)` 是文档推荐写法），
于是列表接口失败一次就把整页业务数据（含 PII）送进 Sentry。

现在按「默认安全」处理：

- `raw` **默认不填充**，`raw.code` 这类结构化读取需要显式 `includeRaw: true`；
- 新增 `rawPreview`（约 500 字符的截断字符串），**永远有值**，日志里照样能看到响应长相；
- 网络层错误的 `raw` / `rawPreview` 仍为 undefined。

```ts
createPageRequest({ fetch, rows: "rows", onError: (e) => reporter.error({ ...e, raw: undefined }) })
createPageRequest({ fetch, rows: "rows", includeRaw: true })  // 需要 raw.code 做分支时
```

**迁移**：如果你的 `onError` 里读了 `event.raw.xxx`，加 `includeRaw: true` 即可恢复；
只想记日志的话改用 `event.rawPreview`。