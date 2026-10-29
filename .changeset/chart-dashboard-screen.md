---
"@fbkworks/chart-core": minor
"@fbkworks/dashboard": minor
"@fbkworks/screen": minor
---

feat: 新增图表、数据看板与可视化大屏三个包

- `@fbkworks/chart-core`：ECharts 封装、令牌主题桥、按需注册、CSS 变量解析
- `@fbkworks/dashboard`：StatCard / StatGroup / TrendChart / BarChart / PieChart / RankList / ChartCard
- `@fbkworks/screen`：ScreenPage（等比缩放）/ Header / Panel / Grid / Number / ScrollList + 四个图表组件

`echarts` 为可选 peerDependency。

### 行为变化

`FbkChart` 的 `init` 与 `setOption` 现在捕获异常并通过 `error` 事件上报，
不再冒泡到全局 —— 一个图表渲染失败不会让整页白屏。
