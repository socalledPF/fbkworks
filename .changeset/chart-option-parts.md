---
"@fbkworks/chart-core": minor
---

导出图表 option 的共享零件，供 dashboard / screen 复用

新增：`FBK_CHART_PALETTE_SIZE`、`seriesColor`、`stackedBarRadius`、`barRadius`、
`CHART_AXIS_LINE` / `CHART_AXIS_LABEL` / `CHART_SPLIT_LINE`。纯新增，无行为变化。

### 为什么

调色板长度此前在 **7 处**硬编码（六个图表组件各一次 + `resolveChartTheme`），
令牌名字符串重复 12 处。改动调色板要手工找全这些点，漏一处就是静默失效
——`var(--fbk-chart-9)` 解析不到时 ECharts 会静默回退成黑色。

现在 `FBK_CHART_PALETTE_SIZE` 是唯一出处，并由一条测试**钉在 tokens 上**：
`--fbk-chart-N` 的个数与它不一致时测试立刻红。

### 顺带

`dashboard` 与 `screen` 的图表 option 输出**逐字段未变**，由
`packages/{dashboard,screen}/tests/chart-option.spec.ts` 的 19 份快照钉住。
