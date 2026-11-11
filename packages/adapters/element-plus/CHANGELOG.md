# @fbkworks/adapter-element-plus

## 0.7.0

### Minor Changes

- 019868e: ### 删掉契约里两个「说谎」的字段

  公开 API 承诺了、实现里没有 —— 使用者照类型写代码会静默无效。这比缺功能更糟：
  缺功能至少会报错，死字段只会让人以为是自己的用法不对。

  **`DataGridProps.presentation`** —— 三个适配器一次都没读过它（`grep props.presentation` = 0）。
  传 `presentation: 'cards'` 得到的是「卡片类的外壳 + 表格 DOM」。
  展示形态唯一的真相是能力位 `capabilities.dataGrid.presentation`，**它保留**，
  ProTable 的外壳类名本来就取自它。

  **`DataGridProps.sort`（入参）** —— 只有 element-plus 读过（用来设 `defaultSort`），
  naive / vant 完全忽略，等于受控排序在 2/3 适配器上不生效。现在删掉，
  排序的对外契约只剩事件 `update:sort`（ProTable 据此发起请求）。
  `ProTableProps.sort` **保留**：它是查询状态的受控入口，被真实读取。

  **`ProTableProps.toolbar`** —— 代码里只判断 `$slots.toolbar`，从不读这个 prop，
  传 `:toolbar="false"` 没有任何效果。插槽 `#toolbar` 保留。

  > 破坏性变更：删除上述三个 prop。仍在传它们的调用处会得到类型错误
  > （这正是想要的：让静默失效变成编译期报错）。
  > **`ProTableProps.sort`** —— 删掉 `DataGridProps.sort` 之后它只剩「播种内部状态」，
  > 驱动不了任何 UI。留着它是**半死路径**：错误重试会把 DataGrid 整块重挂，
  > 表头箭头全灭而内部排序仍在生效，界面显示的排序与实际数据顺序相反。
  > 排序现在是纯事件驱动：点表头 → `update:sort` → 你据此请求。
  > 需要初始排序时写进 `params` 或 `request` 闭包里。

  **`ProTableUiProps.actions`** —— 声明了但全仓零读取，传了静默无效（与 toolbar 同一类）。

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

- Updated dependencies [019868e]
  - @fbkworks/adapter-core@0.7.0

## 0.6.0

### Minor Changes

- 1734d71: ### 三个适配器的语义对齐（同一个 props 必须得到同一个结果）

  一致性套件过去只断言「有没有发出事件」，所以下面三处真实分歧全部漏网。现在都修了，
  并且套件补上了**结果断言**（并且验证过：把修复还原，新断言会红）。

  **element-plus 的 `DataGrid` 从不读 `selectedKeys`** —— 受控选择是单向的：
  父级把 `selectedKeys` 置空（ProTable 的 `clearSelection()` 就是这条路）后勾选框仍然勾着，
  而 naive / vant 都跟着外部状态走。现在把 `props.selectedKeys` 真正映射到 ElTable 的选择状态，
  并用一个 `syncing` 标记挡住自己触发的那次 `selection-change`，避免「外部置空 → 组件回写非空」的抖动。

  **naive-ui 声明 `sort: 'custom'` 却用 `sorter: 'default'`** —— 也就是嘴上说「只发事件」，
  手上却在本地把当前页重排一遍。服务端分页时会对当前页二次排序，且与 element-plus 行序不一致。
  现在改成 `'custom'`。

  **vant 声明 `pagination.mode: 'infinite'`，`Pagination` 原语默认却是 `'pages'`** ——
  能力位说无限滚动、直接使用原语却拿到页码分页器。现在 `mode` 进入 `PaginationProps` 契约
  （以前它根本不在契约里，业务侧无法类型安全地设置），vant 的默认值对齐自己的能力位
  （`'infinite'`），桌面端仍为 `'pages'`。

  > 行为变化：vant 的 `Pagination` 在不传 `mode` 时渲染「加载更多」而不是页码器。
  > 需要页码器请显式传 `mode: 'pages'`。ProTable 不受影响（它在 infinite 能力下根本不渲染分页器）。

### Patch Changes

- Updated dependencies [1734d71]
  - @fbkworks/adapter-core@0.6.0

## 0.5.0

### Minor Changes

- 879d9e3: ### 新增 `DataGrid` / `ProTable` 的 `empty` 插槽

  自定义空态。不传时行为完全不变（适配器自己的空态组件 + `emptyText` 文案）。

  为什么不给空态再造一个组件：`FbkEmpty` 曾存在并被删掉 —— 它只是把同一件事又包了一层。
  一个插槽就够了，三个适配器共用同一语义：**传了就用业务内容，没传才渲染默认空态**。

  ### `useAdapter()` 增加 apiVersion 运行时护栏

  `components` 与 `adapter-core` 目前同组发布，但拆 `fixed` 之后两者可以各自升级。
  那时「组件 0.5 配 core 0.4」或「core 0.5 配一个按 0.4 契约写的适配器」在构建期都不会报错，
  只会在运行时少一个原语、多一个被忽略的字段。

  现在每个组件取适配器都要经过 `useAdapter()`，版本对不上会立刻抛出带双方版本号的错误。
  放在入口而不是每个组件里，就不存在「漏了一个组件」。

### Patch Changes

- Updated dependencies [879d9e3]
  - @fbkworks/adapter-core@0.5.0

## 0.4.0

### Minor Changes

- 7e8785c: ### 移除 `capabilities.theme.cssVariables`

  这条能力位被删除。

  **为什么**：

  - **零消费者**——审计过业务组件（`packages/components`、`dashboard`、`screen`），没有任何一处读取它
  - **语义无法界定**——它想表达的是「能不能用 CSS 变量改主题」，但三个适配器的 `style.css`
    都在用 `var(--fbk-*)`（element-plus 63 次、vant 76 次、**naive-ui 也有 63 次**），
    而 naive-ui 却声明为 `false`。到底指「我们的样式用变量」还是「UI 库内部用 CSS-in-JS 导致变量不穿透」，
    从代码里无法确定
  - **无法机械验证**——按「style.css 是否用变量」来查，三家用量相当，判不出 naive 的 `false`

  一个既没人读、又说不清含义、也验不了的声明，留着只会误导。

  **影响**：如果你读过 `adapter.capabilities.theme.cssVariables`，请改为直接覆盖 `--fbk-*` 令牌
  （三个适配器的样式都基于它们），或按具体的 UI 库能力自行判断。

  ### 顺带：能力位欠债清零

  `pnpm check:capabilities`（strict）从「11 条未验证」降到 **0**，并已加入 `pnpm verify`（第 15 步）
  与 CI。达成路径里修掉了 4 个真实缺陷，详见 commit c0b551c / ac659e9 / 8aa181e / cdc1de2。

### Patch Changes

- Updated dependencies [7e8785c]
  - @fbkworks/adapter-core@0.4.0

## 0.3.0

### Minor Changes

- 899a1a6: ### BREAKING：移除 `Empty` 原语

  `UiPrimitives.Empty`、`EmptyProps` 与三个适配器导出的 `Empty` 组件已删除。

  **为什么**：它是唯一一个「零消费者」的必填原语。

  - 业务组件里访问 `adapter.primitives.Empty` 的地方：**0 处**
  - `DataGridProps` 只有 `emptyText?: string`，**没有 `empty` 插槽**，所以业务层无法注入它
  - 三个适配器的 `DataGrid` 直接 import 自家 UI 库的空态组件
    （element-plus 用 `ElTable` 自带的空态、naive-ui 用 `NEmpty`、vant 用 `VanEmpty`）

  也就是说它声明在公共契约里，但两头都够不着：业务层没有入口，适配器层不需要它（用自己的 DataGrid 调自己提供的 Empty 是自引用）。

  **影响**：如果你在业务代码里用过 `adapter.primitives.Empty` 或从适配器包 import 过 `Empty`，
  请改用 UI 库自身的空态组件。适配器的 `DataGrid` 空态行为**不变**（它本来就不走这个原语）。

  **不升 `ADAPTER_API_VERSION`**：移除必填项向后兼容 —— `assertAdapterCompatible` 只做超集检查
  （`required` 里的键都必须存在），多出来的 `Empty` 会被忽略。按旧的 v3 写的适配器继续可用。

  > 这也印证了一条判据：**新增原语会破版（旧适配器缺成员），移除原语不会。**
  > 所以「新增」该走特性层，「移除」不需要动版本号。

  ### 顺带

  `FbkProTable` 目前**无法自定义空态**，只能改文案 —— 因为契约里没有 `empty` 插槽。
  这是独立于本条的一个产品缺口，留待单独评估。

### Patch Changes

- 1713bd7: 收回四个从未实现的能力声明

  `dataGrid` 的 `expandable` / `tree` / `stickyHeader`（element-plus 与 naive-ui）
  以及 `virtualScroll`（naive-ui）此前声明为 `true`，但 `DataGridProps` 里
  **根本没有对应 prop** —— 也就是说它们不只是没实现，连请求的入口都不存在。

  调用方按能力位分支（`if (capabilities.dataGrid.tree) { ... }`）会以为传树形数据
  能工作，实际拿到的是一张平铺的表，且没有任何警告。

  现在如实声明为 `false`。要真正支持，需要先在 `DataGridProps` 加 prop、
  三个适配器各实现、再补一致性用例 —— 那是一轮独立设计，不是一个布尔值的改动。

  ### 顺带：能力位与实现的绑定校验

  新增 `packages/internal/adapter-conformance/tests/capability-coverage.spec.ts`：
  要求**每一个「真值」能力位都交代由谁验证** —— 一致性用例（`@capability` 标记）、
  静态成员判定、或显式登记为 `unverified` 欠债。

  它随 `pnpm test` 运行，所以以后新增能力位却没人验证会直接红。
  `pnpm check:capabilities` 是 strict 模式（`unverified` 也算失败），
  用于发版前强制还债 —— 当前还有 11 条已登记的欠债。

- Updated dependencies [78877e5]
- Updated dependencies [e7618b7]
- Updated dependencies [899a1a6]
  - @fbkworks/tokens@0.3.0
  - @fbkworks/shared@0.3.0
  - @fbkworks/adapter-core@0.3.0

## 0.2.0

### Minor Changes

- b775fd7: 新增 `Drawer` 原语与 `FbkDetailDrawer` 组件（P4-2）

  ### ⚠️ 破坏性契约变更：`ADAPTER_API_VERSION` 2 → 3

  `Drawer` 是**必填**原语。旧适配器缺少它会在启动时被 `assertAdapterCompatible` 拦下。
  第三方适配器必须实现 `Drawer` 并升版。

  为什么不设为可选：可选意味着 `FbkDetailDrawer` 必须准备降级路径，
  而每一种降级都是「用户以为能用、实际表现不同」——项目一贯的判断是显式失败优于静默降级。
  三个第一方适配器都有原生抽屉能力（`ElDrawer` / `van-popup position` / `NDrawer`），
  所以「必填」的现实成本接近零。

  ### 契约

  新增 `DrawerProps`：`{ modelValue, title, width, placement: 'right' | 'bottom',
closeOnClickModal, showClose }`。

  ### 三个适配器

  | 适配器       | 实现                 | 说明                                                                                                                                                                                                                                                       |
  | ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | element-plus | `ElDrawer`           | `ElDrawer` 只在**离场动画结束**后 emit `update:modelValue(false)`——动画被打断就永不发出，无 transitionend 的环境（jsdom）一次都不发。因此关闭意图改走 `beforeClose` 同步发出。副作用：EP 的抽屉是**纯受控**的，父级不接 `v-model` 就不会关，与另两家一致。 |
  | vant         | `van-popup position` | `van-popup` 没有 title 容器，自带的 `closeable` 只是图标且不发关闭事件，所以标题栏由适配器自绘（`fbk-vant-drawer__*`）。                                                                                                                                   |
  | naive-ui     | `NDrawer`            | `NDrawerContent(title, closable)`。                                                                                                                                                                                                                        |

  顺带修掉一个既有缺陷：`DialogProps.placement` 声明了却没人读（element-plus 与 naive-ui
  的 Dialog 都是 0 次引用），只有 vant 真正用它。现在 EP 用 `align-center` + 贴底规则、
  naive 用 `align-self: flex-end` + 全宽，两家的 `center` / `bottom` 行为可区分。

  `vant` 的 `capabilities.overlay.supportsDrawer` 由 `false` 改为 `true`——此前声明与本仓库实现不符。

  ### 组件：`FbkDetailDrawer`

  **不实现字段渲染，也不实现三态。** 内容区整体就是 `FbkDetailPage`（只把页面头部关掉）：
  同一份 `request`、同一次取数、同一套 `DescriptionItem` 与 `field-*` 插槽。
  抽屉与页面因此不会出现「同一份数据两种表现」。

  - 桌面 `placement='right'`、宽度默认 **480px** 可配置；移动端（视口 ≤ **639px**）`bottom` 且铺满
  - `request` 返回 `null` → 抽屉内渲染 404 态而不是空白
  - 「展开为整页」只发 `expand` 事件，组件**不做路由跳转**（库不该假设 SPA 结构）
  - 与 `CrudPage` 的关系是 **slot 组合**：`CrudPage` 的 props 与行为零变化。
    它明确写着「不内置增删改 —— 只负责列表这一屏」，把详情抽屉塞进去会违背这条原则。

  ### 测试

  一致性套件新增 5 条 Drawer 用例（打开渲染 title 与默认插槽、关闭不可见、关闭控件发出
  `update:modelValue(false)`、`right`/`bottom` 方位、`closeOnClickModal` 正反两向），
  三个适配器零 skip。套件的必填原语清单与断言数（现已 23 条）同步更新。
  新增 `api-version.spec.ts` 钉住「缺 Drawer 被拦」「apiVersion=2 被拦」。

- 4441ba5: Provider 层补齐 attrs 转发、嵌套主题回滚与 system 主题跟随

  ### 行为修复

  - **`<FbkProvider>` 与三个适配器的 RootProvider 丢失 attrs**：与上一轮修的
    9 个组件同源缺陷。真实断点在三个 RootProvider（`inheritAttrs: false` 且不转发）；
    `FbkProvider` 原先靠 Vue 的隐式 fallthrough 侥幸工作——那只在「渲染根恰好是单个组件」
    时成立，根结构一变就静默失效。现在显式转发。

  - **嵌套 Provider 卸载后主题不回滚**：`watchEffect` 随 scope 停掉，没有人把父级主题
    重新 apply。实测嵌套 `[light, dark]` 卸载内层后 `data-fbk-theme` 停留在 dark。
    现在用挂载栈：卸载时交给仍在挂载的上一个 Provider，否则回到外层上下文。
    用栈而不是只回滚父级，是因为兄弟 Provider 并存时（微前端 / 多根）卸载其中一个
    不该把另一个正在生效的档位抹掉。

  - **`theme: 'system'` 不跟随系统切换**：原实现只在 apply 时读一次
    `matchMedia().matches` 快照。现在把它变成响应式，`change` 监听随卸载移除。

  - **`vant` 的 DataGrid 在「空数据 + loading」时什么都不渲染**：`loading` 条要求
    `data.length > 0`，而 Empty 又要求 `!loading`——首次加载时整个列表区空白，
    用户看不到任何反馈。现在 loading 条不再要求 data 非空。

  - **`CrudPage.reset()` 每次点击发两个请求**：先重置表单（触发 params 变化 → 第 1 页
    查询），又补一次 `refresh()`，其中一个必被丢弃。现在有查询区时只重置表单，
    由 params 变化驱动；无查询区时才显式刷新。

  ### ⚠️ 一处 DOM 结构变化

  `element-plus` 的 `<FbkProvider>` 现在会多渲染一层 `<div>`：

  ```
  ElConfigProvider 的 render 是 renderSlot(slots, 'default') —— fragment 根，没有元素
  可承载 attrs（绑上去只会得到 Vue 的 "Extraneous non-props attributes" 并被丢弃）。
  ```

  `vant` 与 `naive-ui` 的 `ConfigProvider` 自带 `div` 根元素，attrs 直接落在上面，
  **不增加层级**。三家的层数因此刻意不对称，这是各库根结构差异决定的，不是遗漏。

  影响面：仅显式使用 `<FbkProvider>` 的路径；`app.use(createBusinessKit())` 不渲染
  Provider，DOM 完全不变。若你的布局依赖 `height: 100%` 链，请确认这层 div 是否需要
  补高度——它没有预设样式。

  ### 测试

  `desktop-parity` 的两条恒真断言已重写并做过变异实验：

  - 「DataGrid 顶层结构与 fbk 类名集合一致」两侧都取到 `[]`，`toEqual([])` 恒真 ——
    给某侧多包一层 div 也照样绿。现在比归一化的结构层级，多包一层会红。
  - 确认框间距原先对整份 style.css 做 `toContain('--fbk-spacing-sm')`，而该令牌在同文件
    别处也有，故实际规则改成写死像素也照样绿。现在按选择器定位到具体规则块逐条断言。

### Patch Changes

- 93f3a28: 修复一轮全仓库代码审查发现的静默失效缺陷

  ### 不报错但行为错误

  - **无限滚动一次触底发两个请求，第一页数据被覆盖**（`use-table-request`）。
    `loadMore()` 改页码后调追加加载，而监听页码的 watch 又触发替换加载，
    两个请求竞争，表现为「偶现」。追加/替换语义改为由 `options.append` 决定——
    该选项一直有调用方（ProTable 传 `() => isInfinite.value`），但 composable 侧从未读取。

  - **筛选条件变化不回到第一页**。停在第 3 页查一个只有 1 页结果的关键词会拿到空列表，
    用户看到「暂无数据」，而数据其实存在。这也是 `CrudPage` 注释早已声明的行为。

  - **`v-permission` 多实例互踩**：指令注册在 app 级指令表上，后注册顶掉先注册且只 dev warn。
    `app.use(createBusinessKit({ permissions }))` 之后再挂一个 `<FbkProvider>`，
    解析器就被换成 `() => []`，按钮成片消失。现在注册前按 app 判重；
    Provider 未传 `permissions` 时改为继承上层，而不是退化成空解析器。

  - **`v-permission` 绑定值变化后 DOM 不更新**：`updated` 只改普通对象属性，
    而依赖追踪只认 ref/reactive。改为 `shallowRef`。

  - **`ProTable` 请求失败显示「暂无数据」**：`requestState.error` 从未被读取。
    现在失败时整块渲染错误态（复用 `FbkResult`）+ 重试按钮，并提供 `#error` 插槽定制。
    `CrudPage` 补 `defineEmits`（此前 `@error` 会作为 attr 落到根元素，永远不触发）。

  - **`vant` 日期控件把用户选的时分静默改写成 `00:00:00`**：滚轮只有年月日三列，
    确认时却读第 4、5 段取时分。`daterange` 只取第一个值，把 `string[]` 压成 `string`。
    改为对 `time` / `datetime` / `daterange` / `datetimerange` 显式拒绝并告警——
    静默降级会改写数据，显式失败更诚实。`type="date"` 不受影响。

  - **`registerFbkCharts` 把未实现的类型标记为已注册**：`map` / `geo` / `toolbox`
    在类型里有、映射表里没有，`filter(Boolean)` 丢弃后仍记入 done 集合，永不重试且无提示。
    现在只标记真正注册成功的项，并对未实现项 `warnOnce`。

  ### 契约与暴露面

  - **删除兑现不了的能力声明**：三个适配器把 `feedback.notification` / `loading` 标为 true，
    但 `FeedbackApi` 里没有这两个成员——按能力位探测后调不到任何东西。现置 false。
    契约本身不变，将来补 API 时把位打开即可。

  - **补齐 `@fbkworks/components` 的 4 个缺失子路径**：`crud-page` / `form-modal` / `result` /
    `detail-page` 及其 `style.css`，以及 `./styles/index.css`，此前均未进入 `exports`，
    消费者装到包后子路径导入直接 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
    `@fbkworks/resolver` 的自动导入映射同步补齐（5 → 9），两者本是同一份清单的两处漂移。

  - **`FbkResult` 未知 `status` 不再崩溃**：`status` 是运行时字符串，后端返回 401 / 422
    时原代码读 `undefined.title`，整块白屏。现在回退到中性默认，合法数字码语义不变。

- 845528a: 统一 `update:sort` 的字段语义，修正 `vant` 的排序能力声明

  ### ⚠️ `@fbkworks/adapter-naive-ui` 的行为变化（可能破坏现有消费方）

  `update:sort` 的 `field` 此前在两个桌面适配器上取自**不同的来源**：

  | 适配器       | 改前 `field`                              | 改后 `field`                     |
  | ------------ | ----------------------------------------- | -------------------------------- |
  | element-plus | `column.dataIndex`（缺省时**emit null**） | `column.dataIndex ?? column.key` |
  | naive-ui     | `column.key`                              | `column.dataIndex ?? column.key` |

  `key ≠ dataIndex` 时（`key` 用作行标识、`dataIndex` 对应后端字段），两家会把
  **不同的字符串**发给后端——同一个页面换适配器，排序参数就变了。

  现在一律取 `dataIndex`，缺省回退 `key`。**依赖「field 等于 column.key」的
  naive-ui 消费方需要检查**：若你的列定义了 `dataIndex` 且与 `key` 不同，
  现在发给后端的是 `dataIndex`。

  顺带修掉一个更严重的问题：element-plus 在 `dataIndex` 缺省时**不回退**，
  `prop` 为 undefined 导致 el-table 回传空字段，适配器判空后 **emit 的是 null**
  ——点击可排序列表头什么都收不到。现在两家都正确回退。

  ### `vant` 的排序能力位

  `capabilities.dataGrid.sort` 由 `'custom'` 改为 `'none'`。卡片列表没有表头，
  全文也没有一处 `emit('update:sort')`——声明与实现是断开的。补齐移动端排序入口
  （下拉 / 筛选栏 / 顶栏菜单）需要产品方案，在那之前用能力位如实声明。

  契约测试同步：`skip: ['sort']` 保留，被跳过的契约项在输出里以 `skipped` 出现，
  而不是让用例无声消失。

  ### 测试基座

  `mock-adapter` 此前同样声明了 `sort: 'custom'` 却从不 emit `update:sort`，
  导致 `ProTable` 的排序链路（含「排序后回到第 1 页」这条业务规则）
  在组件测试里**一次也执行不到**。现在 mock 会渲染表头与排序控件、
  按契约发出三态 `update:sort`，该规则已被测试覆盖。

- Updated dependencies [b775fd7]
- Updated dependencies [1a36dc8]
- Updated dependencies [c802946]
- Updated dependencies [4441ba5]
- Updated dependencies [93f3a28]
- Updated dependencies [768d28f]
- Updated dependencies [845528a]
  - @fbkworks/adapter-core@0.2.0
  - @fbkworks/shared@0.2.0
  - @fbkworks/tokens@0.2.0
