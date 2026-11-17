---
"@fbkworks/chart-core": minor
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-naive-ui": patch
"@fbkworks/adapter-vant": patch
---

### 删掉 map 图型；resetFields 的语义写清楚并显式告警

**FbkChartType 不再包含 map。** 它从来没有被实现过：CHART_MAP 里没有它，
echarts 的 map 还需要业务方提供 GeoJSON（registerMap），本库没有这个入口。
留着它意味着「类型上允许、注册时被静默丢弃」。需要地图请直接用 echarts 或专门的地图组件。

**resetFields 的三端差异写进契约并显式告警。**
契约一直是「清值 + 清校验」，但只有 element-plus 做得到 —— naive-ui / vant 的 Form
拿不到初始值，只能清校验，而且**静默**如此：用户点「重置」看到输入值原样保留，以为按钮坏了。

- element-plus：不变（原生支持）
- naive-ui / vant：清校验 + warnOnce 提示「清值请业务方重置 v-model」
- 只想清红框：用 clearValidate（三端语义一致）