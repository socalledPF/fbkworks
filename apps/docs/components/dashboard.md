# 数据看板

嵌入 B 端后台页面的统计模块。**白底卡片、细边框、与 ProTable 同一视觉语言** ——
它是后台的一部分，不是独立的可视化大屏（大屏见 [@fbk/screen](/components/screen)）。

## 安装

```bash
pnpm add @fbk/dashboard @fbk/chart-core echarts
```

`echarts` 是 **peerDependency**（可选），不装图表组件就无法工作。

## 基础用法

```vue
<script setup lang="ts">
import { FbkStatCard, FbkStatGroup, FbkTrendChart } from '@fbk/dashboard'
import '@fbk/dashboard/style.css'
</script>

<template>
  <FbkStatGroup :columns="{ xs: 1, sm: 2, lg: 4 }">
    <FbkStatCard title="总销售额" :value="1284500" prefix="¥" :change="12.5" change-label="较上月" />
  </FbkStatGroup>

  <FbkTrendChart
    title="销售趋势"
    :categories="['周一', '周二', '周三']"
    :series="[{ name: '销售额', data: [820, 932, 901] }]"
    height="300px"
  />
</template>
```

## 组件

| 组件 | 说明 |
|---|---|
| `FbkStatCard` | 指标卡：数值、变化率、迷你趋势图 |
| `FbkStatGroup` | 指标卡栅格（响应式） |
| `FbkTrendChart` | 折线 / 面积趋势 |
| `FbkBarChart` | 柱状 / 条形（支持堆叠） |
| `FbkPieChart` | 饼 / 环形（支持中心文案） |
| `FbkRankList` | 排行榜（带进度条） |
| `FbkChartCard` | 图表卡片外壳（自定义图表时复用） |

## StatCard 的变化率语义

`change` 的方向**不等于**好坏。退款率上涨是坏事，所以有 `changeTone`：

```vue
<!-- 默认 auto：涨=正向（绿） -->
<FbkStatCard title="销售额" :value="100" :change="12.5" />

<!-- 显式指定：退款率上涨是负向（红） -->
<FbkStatCard title="退款率" :value="1.8" :change="0.4" change-tone="negative" />
```

## 图表配色

色板来自 `--fbk-chart-1..8` 令牌，随主题自动切换。
**不要在 option 里写死色值** —— 换主题时图表不会跟着变。

色板经过对比度验证（图形 ≥3:1、相邻色 ΔE ≥10），见
[设计文档](https://github.com/54356/frontend-business-kit/blob/main/docs/design/2026-10-22-dashboard-screen.md)。

## 自定义图表

需要图表库里其他类型时，直接用 `@fbk/chart-core` 的 `FbkChart`：

```vue
<script setup lang="ts">
import { FbkChart } from '@fbk/chart-core'
import '@fbk/chart-core/style.css'

const option = { /* ECharts option */ }
</script>

<template>
  <FbkChart :option="option" height="300px" />
</template>
```

`FbkChart` 负责：生命周期、ResizeObserver 自适应、主题切换重建、空态、CSS 变量解析。
