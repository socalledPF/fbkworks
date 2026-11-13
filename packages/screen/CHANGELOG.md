# @fbkworks/screen

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
