# @fbkworks/data

## 0.5.0

### Minor Changes

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

## 0.4.0

### Minor Changes

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

## 0.3.0

### Minor Changes

- 78877e5: 首次公开发布：版本号与 UI 栈对齐到 0.3.0

  这四个包本次没有代码变更。写这条 changeset 的唯一目的是让**第一次**发布时
  所有包同号，避免「kit 说是 0.3.0，tokens 却是 0.2.0」这种首发噪音。

  **这是一次性的，不是常设耦合。** 从 0.4.0 起它们各自独立演进：

  - 补丁级修复只发受影响的包（`workspace:^` 的 `^0.3.0` 范围不会因此失效）
  - 破坏性变更仍会牵动下游，由 changesets 的 `updateInternalDependencies: "patch"`
    自动把下游的 patch 版本带起来

  见 `.changeset/config.json` 的 `fixed` 组：现在只剩 8 个 UI 栈包锁步
  （adapter-core / chart-core / 三个适配器 / components / dashboard / screen）。
  tokens、shared、data、resolver 已不在其中。

### Patch Changes

- Updated dependencies [78877e5]
  - @fbkworks/shared@0.3.0

## 0.2.0

### Minor Changes

- c802946: feat(data): 新增契约层 `@fbkworks/data`，分页契约收敛为单一定义处

  ### 新增

  `createPageRequest` 把任意形状的后端响应映射成 `Page<T>`，业务方只写
  「字段在哪」。支持点号路径（含数组下标）、业务码判定、行映射、
  数据级权限声明、错误上报钩子。

  ### 行为变化

  - **`@fbkworks/components` 的分页契约改为 `@fbkworks/data` 的别名**：
    `TableRequestParams` = `PageQuery`、`TableResponse` = 放宽 total 的 `Page`、
    `TableRequest` 结构不变。现有调用零改动，但类型定义的来源变了。
  - 之前的「两处同形接口 + 注释声称兼容」改为编译期断言
    （`packages/components/tests/contract-compat.spec.ts`）。任何人改动
    `@fbkworks/data` 的分页契约，components 侧会立刻编译失败。
  - `createPageRequest` 新增 `onError` / `feature` 配置，用于错误上报。
    `AbortError` 不上报（取消不是错误）。

- 3ea4bcf: feat(data): 新增 `defineBackend`，后端惯例只写一次

  ### 问题

  一个项目通常只有 1-2 种响应形状，但 `createPageRequest` 要求每个
  列表接口重复描述 `rows` / `total` / `isSuccess` / `errorMessage`。
  12 个接口 × 6 行 = 72 行，其中 60 行是纯重复。

  ### 解法

  ```ts
  // src/api/backend.ts —— 全项目唯一一处
  export const api = defineBackend({
    request: (url, params, signal) => http.get(url, { params, signal }).then((r) => r.data),
    rows: 'content',
    total: 'totalElements',
    isSuccess: (res) => res.code === 200,
    errorMessage: (res) => res.msg,
    mapParams: ({ page, pageSize, params }) => ({ pageNum: page, pageSize, ...params }),
  })

  // src/api/order.ts —— 每个接口只剩自己的信息
  export const fetchOrders = api.page('/api/order/list', { feature: 'order.list' })
  ```

  ### 两种形态

  - **A** 传路径：`api.page('/api/orders')`，用后端惯例的 `request`
  - **B** 传 fetcher：`api.page(({ page, signal }) => http.get(...))`，逃生口

  B 形态只接管「怎么发请求」，解析仍用后端配置。

  ### 兼容

  `createPageRequest` 完全不变，`defineBackend` 是叠加的层。
  内部也复用它 —— 错误上报、路径解析、AbortError 不吞等行为自动继承，
  不存在两套实现漂移。

### Patch Changes

- 7f1024d: fix(data): `total` 为 null / 空字符串时抛错，不再静默当成 0

  ### 行为变化（需要关注）

  `Number(null) === 0`、`Number('') === 0` —— 之前 `extractTotal` 会把
  `total: null` 静默转成 0。

  后果：后端返回 `total: null`（「暂无数据」或字段未初始化时很常见）时，
  分页器显示「共 0 条」，而实际可能有数据。用户看到的是错误信息，
  且没有任何报错，排查成本很高。

  现在抛 `FbkDataError`，消息里解释原因并给出替代方案
  （`total: (raw) => rows.length` 或直接不传 `total`）。

  ### 如果确实可能没有 total

  ```ts
  // 方案一：用列表长度兜底
  createPageRequest({ fetch, rows: 'rows', total: (raw) => raw.rows.length })

  // 方案二：不传 total（默认用 rows.length）
  createPageRequest({ fetch, rows: 'rows' })
  ```

- Updated dependencies [1a36dc8]
  - @fbkworks/shared@0.2.0
