---
"@fbkworks/data": minor
"@fbkworks/chart-core": patch
---

### `@fbkworks/data`：三处「默认值被静默关掉」

**显式 `undefined` 不再覆盖后端惯例** —— `page(url, { total: undefined })` 以前会把
`total` 覆盖成 `undefined`，于是改用兜底的 `rows.length`（实测 57 → 2）；
`isSuccess: undefined` 更糟，业务码判定整个失效，失败响应被当成空列表。
这种写法很常见（`{ total: opts?.total }`），现在逐个过滤掉 `undefined`。

**`isSuccess` / `errorMessage` 抛错会被上报** —— 它们以前在 `try` 之外：
空 body（`raw` 是 `null`）时读 `raw.code` 抛未捕获的 TypeError，
`onError` 一次都收不到，等于「请求失败了但监控里什么都没有」。

**`total` 的解析更严格** —— `Number('  ')`、`Number([])`、`Number(false)` 都是 0，
静默转换会让分页器显示「共 0 条」，和历史缺陷 `total: null` 完全同一种伪装。
现在只接受数字与非空白的数字字符串。

> 行为变化：`total` 为纯空白字符串 / 数组 / 布尔值时从「静默变 0」改为抛
> `FbkDataError('path')`。

### `@fbkworks/chart-core`：两处图表状态残留

**`setOption` 改用它该用的合并策略**（`replaceMerge: ['series', 'legend']`）——
纯合并（`notMerge: false`）有两个实测后果：系列变少时旧系列连同旧数据继续渲染
（用户筛掉一条线，画面上还留着它）；新配置没有 `legend` 时图例不会被移除
（合并语义下「没给」=「别动」）。这也是那四个图表组件敢写
「`series.length > 1 ? legend : undefined`」的前提。

**主题监听不再盯 `class`** —— 以前 `<html>` 上任何 class 变化都会 dispose + init：
外部通过 `getInstance()` 拿到的句柄立刻变成已销毁实例，loading 遮罩与动画也被重置。
主题契约就是 `data-fbk-theme`（见 `adapter-core/plugin.ts`）。顺带删掉只写不读的
`themeVersion`。
