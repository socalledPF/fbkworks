# @fbkworks/screen

## 0.9.0

### Minor Changes

- 3346f18: ### 大屏图表的轴色与网格线不再跟随全局主题

  大屏的框架色一直是硬编码的 cyber 色值，但图表轴色走 `var(--fbk-chart-axis-*)` 令牌 ——
  令牌解析的是 `documentElement` 上**当前生效**的主题。于是把大屏嵌进浅色后台时：

  - 轴标签 `#646a73` 压在 `#050910` 上，**3.66:1，不达 AA**；
  - 网格线是近黑色的刺眼白；
  - 现在固定取 cyber 值（`#94b8c4` / `#142433` / `#1b3040`，9.41:1）。

  **迁移**：无需改代码。若你依赖「大屏跟随全局主题」这一行为，请把图表配色显式写进 option。

  同时 `verify-charts` 的大屏验收改为 `theme=cyber` —— 之前一直用默认 light 主题跑，
  「浅底大屏 + 看不清的刻度」能一路绿着。

- 4627ccd: ### 类型与契约族：把「声明了不生效」的四处补齐或删掉

  这一批改动只有一个主题：**类型里承诺的东西必须是运行时真的做了的事**。
  四处违约各有各的方向 —— 该有的类型没有（传了没报错、也生效不了），
  不该有的字段还在（写了没效果），注释写着另一种行为（读的人会被误导）。

  #### CrudPage 插槽：`field-*` 等六个名字补进类型（不破版，是修漏）

  `CrudPage.vue` 的 `passedSlots` / `passedQuerySlots` 已经转发 `empty` / `card-footer` /
  `actions` / `before-actions` / `after-actions` / `field-<name>`，但 `CrudPageSlots` 里只有
  `toolbar` / `bulk-actions` / `error` / `form` / `cell-*`。

  后果是「运行时能跑、模板里报错」：`<template #field-status>` 在 `FbkCrudPage` 上直接
  TS 报错（`v-for` 动态转发不参与模板类型检查，所以没人发现），IDE 也不补全。
  现在补上两个模板字面量索引签名（`cell-*` 与 `field-*` 可以并存）。

  `apps/docs/components/crud-page.md` 的插槽表同步补齐，并写明它必须与两个白名单逐字对齐。

  #### `CrudPageProps.tableProps` 不再接受 `immediate`（**破版：类型**）

  `tableProps` 的 `Omit` 没排除 `immediate`，但 `CrudPage.vue` 展开时是
  `{ ...tableProps, ..., immediate: props.immediate }` —— 写在 tableProps 里的那个
  在对象里排前面，**被顶层 prop 静默压掉**：类型合法、行为无效。

  **迁移**：把 `:table-props="{ immediate: false }"` 改成 `:immediate="false"`。
  行为不变（那种写法本来就不生效），只是现在会在编译期报错而不是静默忽略。
  其余 `tableProps` 字段（`page` / `pageSize` / `pagination` / `uiProps` 等）不受影响。

  #### `ProTableSlots['bulk-actions']` 的注释按实现改正（不破版）

  注释写着「仅在选中行时渲染」，而 `ProTable.vue:276` 的条件是
  `selectionEnabled && rowKeys.length > 0 && !errorState` —— **没有选中行时也渲染**，
  表头「全选当前页」与已选计数就在这个容器里。照旧注释写的人会给按钮漏掉
  `selectedKeys.length` 判断，于是「0 选中也能点批量删除」。只改注释，行为未动。

  #### `FormModal`：关闭时清掉命令式残留值（修 bug，不破版）

  `pendingValues` 只在 `show` 发生 false→true 跳变时被消费。于是只要出现一次
  「命令式打开但 show 没有跳变」—— 已打开状态下再 `openEdit()` 一次，或父级否决了
  这次打开 —— 它就留到下一轮，**盖掉 initialValues**：表现为「编辑 A，表单里是上一次的 B，
  保存把 B 写进 A」。现在 `clearOnClose` 里一并置 `null`，并用一条用例钉住
  （`packages/components/tests/form-modal.spec.ts`，先红后绿）。

  顺带删掉 `withDefaults` 里残留的 `autoFocus: true` —— 该 prop 在 0.8.0 已从类型删除，
  SFC 编译器会静默丢弃未声明的默认值，但留着等于承诺一个不存在的 prop。

  #### `ScreenPageProps.fullscreen` 删除（**破版：类型**）

  `ScreenPage` 只渲染一个默认插槽，从不渲染 `ScreenHeader` —— `fullscreen` 在模板里
  零引用，传了没有任何效果。真正读它的是 `ScreenHeader.vue:78`。

  **迁移**：把 `fullscreen` 写到 Header 上，而不是页面容器上：

  ```vue
  <!-- 之前：声明了、但不生效 -->
  <FbkScreenPage :fullscreen="false"> ... </FbkScreenPage>

  <!-- 现在 -->
  <FbkScreenPage>
    <FbkScreenHeader title="运营监控" :fullscreen="false" />
    ...
  </FbkScreenPage>
  ```

  两个包都按本仓 0.x 的既有约定用 **minor**（0.8.0 删掉 `ProTableAction.icon`、
  `FormModal.autoFocus` 等死字段时同样是 minor）：删掉的是**从来没生效过**的声明，
  迁移只需改一行，运行时行为不变。

### Patch Changes

- Updated dependencies [3346f18]
  - @fbkworks/chart-core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [7b204e9]
  - @fbkworks/chart-core@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies [73fa267]
  - @fbkworks/chart-core@0.7.1

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

- Updated dependencies [0dc3af2]
  - @fbkworks/chart-core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [1b5aae8]
  - @fbkworks/chart-core@0.6.0

## 0.5.0

### Patch Changes

- @fbkworks/chart-core@0.5.0

## 0.4.0

### Patch Changes

- @fbkworks/chart-core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [7f1dd87]
- Updated dependencies [78877e5]
  - @fbkworks/chart-core@0.3.0
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

- Updated dependencies [7e18792]
- Updated dependencies [c802946]
- Updated dependencies [1a36dc8]
- Updated dependencies [768d28f]
  - @fbkworks/chart-core@0.2.0
  - @fbkworks/shared@0.2.0
  - @fbkworks/tokens@0.2.0
