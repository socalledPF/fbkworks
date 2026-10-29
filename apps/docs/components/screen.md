# 可视化大屏

独立全屏页面，暗底科技蓝，按 **1920×1080** 设计稿等比缩放。

与 [数据看板](/components/dashboard) 是两套视觉语言：看板嵌入后台、白底；
大屏独立全屏、暗底发光。不混用。

## 基础用法

```vue
<script setup lang="ts">
import {
  FbkScreenPage,
  FbkScreenHeader,
  FbkScreenPanel,
  FbkScreenLineChart,
} from '@fbkworks/screen'
import '@fbkworks/screen/style.css'
</script>

<template>
  <FbkScreenPage>
    <FbkScreenHeader title="运营数据监控中心" />

    <FbkScreenPanel title="实时流量趋势" style="height: 400px">
      <FbkScreenLineChart :categories="hours" :series="series" height="100%" />
    </FbkScreenPanel>
  </FbkScreenPage>
</template>
```

## 等比缩放

按 1920×1080 写死像素，用 `transform: scale()` 整体缩放，取
`min(scaleX, scaleY)` 保证不变形、居中留边。

**为什么不用 vw/vh 自适应**：大屏里图表、字号、间距全按固定像素设计，
用相对单位会让"1920 下正好放 8 个面板"变成"1440 下放不下"。
等比缩放保证任何分辨率下看到的**构图完全一致**。

```vue
<!-- 拉伸铺满（可能变形，一般不用） -->
<FbkScreenPage mode="fill" />
```

## 组件

| 组件 | 说明 |
|---|---|
| `FbkScreenPage` | 根容器：等比缩放、背景网格与光晕 |
| `FbkScreenHeader` | 标题栏：发光标题、时钟、全屏按钮 |
| `FbkScreenPanel` | 数据面板：四角装饰、标题竖条 |
| `FbkScreenGrid` | 24 列栅格 |
| `FbkScreenNumber` | 数字翻牌（变化时滚动动画） |
| `FbkScreenScrollList` | 自动轮播列表（悬停暂停） |
| `FbkScreenLineChart` | 折线（带发光、面积渐变） |
| `FbkScreenBarChart` | 柱状（带发光） |
| `FbkScreenPieChart` | 环形（带中心数值） |
| `FbkScreenGaugeChart` | 仪表盘 |

## 布局要点

大屏面板需要**明确高度**才能让图表撑满。用 flex 时注意 `min-height: 0`：

```vue
<FbkScreenGrid :columns="24" gap="md" style="height: 668px">
  <div style="grid-column: span 12; display: flex; flex-direction: column; min-height: 0">
    <FbkScreenPanel title="趋势" style="flex: 1 1 0; min-height: 0">
      <FbkScreenLineChart :categories="x" :series="s" height="100%" />
    </FbkScreenPanel>
  </div>
</FbkScreenGrid>
```

`min-height: 0` 是必须的：flex 子项默认 `min-height: auto` 会按内容撑开，
而图表是 `height: 100%` —— 互相依赖，最终高度为 0，图表全空白。

## 可访问性

- 数字动画尊重 `prefers-reduced-motion`
- 全屏按钮带 `aria-label`
- 面板标题使用语义化 `<h2>`
