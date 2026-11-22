---
"@fbkworks/chart-core": minor
---

### 默认注册集从映射表推导；loading 遮罩跟底色

**注册集**：`DEFAULT_CHARTS` / `DEFAULT_COMPONENTS` 改为 `Object.keys(CHART_MAP)` /
`Object.keys(COMPONENT_MAP)`。此前手写 4 个图型、8 个组件，而 JSDoc 写着「不传 = 注册全部」：

- 写 `charts: ['scatter']` 或 `radar`/`funnel` → 静默空白；
- 用 `visualMap` 色阶或 `dataZoom` 缩放 → 只有一行 console，整块不渲染，`emit(error)` 也不触发。

现在默认 7 个图型 + 11 个组件。**需要地图（`map`）的请注意：该图型已删除**，
echarts 的 map 还需要业务方提供 GeoJSON，本库没有这个入口。

**loading 遮罩**：`maskColor` 之前固定 `rgba(255,255,255,0.6)`，暗色后台 / 大屏上每次刷新整块图表变白，
而「加载中」文字用的是 `--fbk-color-text-secondary`，压在灰白遮罩上约 **1.2:1** 读不出来。
现在按 `--fbk-color-bg` 的亮度选白纱或暗纱。