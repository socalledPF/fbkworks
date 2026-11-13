# @fbkworks/chart-core

## 0.7.1

### Patch Changes

- 73fa267: ### 修掉 dataZoom / visualMap 的残留（同一实例切图型后旧缩放条不消失）

  合并语义下「新 option 没给 dataZoom」= 「别动」，于是同一个图表实例换图型之后，
  旧的缩放条会一直留在画面上（用户筛掉一部分数据、或从折线切到饼图时最明显）。

  现在按 **option 形状**决定合并策略：

  - 形状不变（只换数据 / 系列）：照旧走 `replaceMerge: [series, legend]`，动画与缩放位置都不重置；
  - 某类组件整个消失：这一次改用 `notMerge: true` 整块重设，把它清干净。

  代价只有「换图型」那一下丢动画 —— 而那时动画本来也要重来。

  > 顺带订正一条文档里的错判：早前记为「replaceMerge 点名 dataZoom 会让大屏图表全灭」，
  > 分层实测后确认 echarts 核心层是正常的（SSR 里残留能清成 0、不抛错），失败只出现在
  > 大屏页面的集成路径上（形态是 `no stage`），根因未定位。因此没有直接用它，而是绕开。

## 0.7.0

### Patch Changes

- 0dc3af2: ### 跨适配器语义对齐与几处静默失效

  **loading 期间不渲染用户提供的空态插槽（三适配器）** —— 首帧 data 必空，
  此时显示空态会把「正在加载」说成「没有数据」。已进一致性套件。

  **loadMore / finished 不再透成 DOM 属性（element-plus / naive-ui）** —— 桌面端两库不声明
  这两个字段，ProTable 无条件传过来时它们落进 attrs 并被展开到表格根节点，
  变成 loadmore="false" finished="false" 这类非法属性，@load-more 也变成原生事件监听器。

  **reload() 清空选中时 emit update:selectedKeys（components）** —— selectedKeys 是受控 prop，
  只改内部值会让父级 v-model 停在旧值：父级批量操作栏显示「已选 1 项」并可执行删除，
  而表格里已经一个都没勾。同时把清空移到「受控 data 直接返回」之前，
  否则 selection.preserveOnReload: false 配 :data 是彻底的空操作。

  **大屏四个图表转发 @error（screen）** —— FbkChart 只 emit 不 console，大屏此前一个都没监听：
  配置写错时图表静默保留上一帧或空白，生产环境没有任何信号。

  **setOption 改用 replaceMerge: [series, legend]（chart-core）** —— 纯合并下系列变少时
  旧系列连同旧数据继续渲染、新配置没有 legend 时图例不会移除。

  > 已知局限：dataZoom / visualMap 被移除后仍会残留。点名它们做 replaceMerge 会让
  > 大屏图表一个都不渲染（CI 视觉回归 5 条 FAIL + 本地 verify-charts 复现，回退即全绿），
  > 所以没有带上。这条今后要动，必须先有「大屏四个分辨率都渲染出来」的验证。

  **主题重建后补回 loading 遮罩（chart-core）** —— 重建实例会让遮罩跟着旧实例消失，
  而 props.loading 没变、watcher 不触发，看起来像加载完了。

  **isSuccess 返回 falsy 即失败（data）** —— 曾经写成 ok === false，于是
  (res) => res.code / (res) => res.data?.ok 这类写法返回的 undefined / 0 / 空字符串
  被当成成功，失败响应带空数组时用户看到「暂无数据」。

  **取消判定覆盖 axios 与自定义 abort reason（data）** —— 第一判据改为 signal.aborted，
  再叠加 AbortError / CanceledError / ERR_CANCELED 三种命名形状。此前 axios 的
  CanceledError 与 abort(reason) 都会被当成错误上报，快速翻页时监控里全是噪音。

  **total 必须是非负整数（data）** —— 负数与小数同样会让分页器显示错数。

  **vant 的 size 写清语义** —— 移动端卡片没有尺寸档位，接受但不产生视觉效果；
  声明它是为了不让它透成非法 DOM 属性，并保持默认值与桌面端一致。

## 0.6.0

### Patch Changes

- 1b5aae8: ### `@fbkworks/data`：三处「默认值被静默关掉」

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

## 0.5.0

## 0.4.0

## 0.3.0

### Minor Changes

- 7f1dd87: 导出图表 option 的共享零件，供 dashboard / screen 复用

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

### Patch Changes

- Updated dependencies [78877e5]
  - @fbkworks/tokens@0.3.0
  - @fbkworks/shared@0.3.0

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
