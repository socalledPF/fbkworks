# @fbkworks/chart-core

## 0.2.0

### Minor Changes

- c802946: feat: 新增图表、数据看板与可视化大屏三个包

  - `@fbkworks/chart-core`：ECharts 封装、令牌主题桥、按需注册、CSS 变量解析
  - `@fbkworks/dashboard`：StatCard / StatGroup / TrendChart / BarChart / PieChart / RankList / ChartCard
  - `@fbkworks/screen`：ScreenPage（等比缩放）/ Header / Panel / Grid / Number / ScrollList + 四个图表组件

  `echarts` 为可选 peerDependency。

  ### 行为变化

  `FbkChart` 的 `init` 与 `setOption` 现在捕获异常并通过 `error` 事件上报，
  不再冒泡到全局 —— 一个图表渲染失败不会让整页白屏。

### Patch Changes

- 7e18792: fix(components, chart-core): `inheritAttrs: false` 下补齐 attrs 转发，`class` / `style` / `data-*` 不再静默失效

  ### 问题

  组件为了控制根元素结构都声明了 `inheritAttrs: false`，但模板里没有
  `v-bind="attrs"`。Vue 在 `inheritAttrs: false` 时**不会**把透传属性渲染到根元素，
  于是消费方写的下面这些全部无声丢失：

  ```vue
  <FbkProTable class="orders-table" style="height: 100%" data-testid="orders" />
  ```

  没有报错、没有警告，只是样式不生效、测试选择器取不到元素 ——
  排查方向会先跑偏到 CSS 优先级或作用域上。

  ### 修复

  受影响组件在根元素上补 `v-bind="attrs"`：

  - `@fbkworks/components`：`ProTable`、`CrudPage`、`QueryForm`、`FormGenerator`、
    `FormModal`、`PageContainer`、`Descriptions`、`Result`
  - `@fbkworks/chart-core`：`FbkChart`（attrs 落在根 `div` 上 —— 它是
    `position: absolute; inset: 0` 的 canvas 的父级，外部 `style` 只有落在这里才影响布局）

  `@fbkworks/dashboard` 与 `@fbkworks/screen` 的组件此前已正确转发，本次无需改动。

  ### 注意

  `v-bind="attrs"` 放在组件自身绑定的**前面**，自身 class 与计算出的 style
  优先级不变，消费方的 `class` / `style` 与之合并而非覆盖。

  落点：除 `FormModal` 把 attrs 转给对话框组件（`Dialog` 的根节点）外，
  其余组件都落在根 `div` 上。

- Updated dependencies [1a36dc8]
- Updated dependencies [768d28f]
  - @fbkworks/shared@0.2.0
  - @fbkworks/tokens@0.2.0
