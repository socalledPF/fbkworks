# @fbkworks/components

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

- 90b2ef2: feat(components): 新增 `DetailPage`，`options` 支持函数形式

  ### `DetailPage`：详情页的约定

  `CrudPage` 把列表页的加载/空/错误变成了组件约定，但详情页没有对应物 ——
  每写一个详情页重复 5-8 行三态代码，且表现不一致（有人用 `FbkResult`，
  有人用一行「加载中…」），错误也不会走 `useReporter()`。

  `FbkDetailPage` 组合 `PageContainer` + `Descriptions` + `Result`，只做编排：

  ```vue
  <FbkDetailPage
    :request="() => fetchOrder(id)"
    :items="items"
    :title="(d) => `订单 ${d.orderNo}`"
    back
  >
    <template #extra="{ data }"><OrderTimeline :order="data" /></template>
  </FbkDetailPage>
  ```

  三态约定：

  - 加载中 → 骨架（不是文字，文字会闪）
  - 请求失败 → `Result status="error"` + 重试
  - **返回 null → `Result status="404"`** —— 不是错误，是资源不存在

  把 404 显示成「加载失败」会让用户反复重试一个不存在的资源。

  同时导出 `useDetail` / `useDetailWatch` composable，供需要自定义模板的场景。
  两者共用同一份实现，不会漂移。

  ### `options` 支持函数形式

  ```ts
  { name: 'city', label: '城市', type: 'select',
    options: (values) => CITIES_OF[values.province] ?? [] }
  ```

  省了业务方自己 watch 省份再改 options 的绕法，也不会出现
  「省份变了但城市还留着旧选项」的状态不同步。

  解析函数抛错时退化为空选项，不让整个表单崩。

  ### 修复

  `CrudPage` 的 `useSlots()` 在 dts 构建阶段报 TS7022（隐式 any）——
  这个错误只在 `build` 时出现，`typecheck` 看不到。已显式标注类型。

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

- 9af24ca: fix(components): `DetailPage` 补齐 `Descriptions` 的属性透传

  ### 问题

  `DetailPage` 的 `items` 复用了 `DescriptionItem`，但只透传了
  `column` / `groups` / `emptyText`，漏了 `bordered` / `direction` / `size`。

  表现为：demo 里写 `<FbkDetailPage bordered>` 完全没有边框，
  而同样的 `bordered` 在 `FbkDescriptions` 上是有效的 ——
  业务方会以为「DetailPage 不支持边框」，只能用 `extra` 插槽自己拼。

  ### 修复

  补齐三项透传。判断标准：**既然 items 复用 DescriptionItem，
  影响「字段怎么显示」的开关也应该能透传。**

  ### 顺带

  `CrudPage` 的 `useSlots()` 在 dts 构建阶段报 TS7022（隐式 any）——
  这个错误只在 build 时出现，typecheck 看不到，之前 `docs:build`
  一直有这个噪音。已显式标注类型。

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

- Updated dependencies [c802946]
- Updated dependencies [3ea4bcf]
- Updated dependencies [7f1024d]
- Updated dependencies [b775fd7]
- Updated dependencies [1a36dc8]
- Updated dependencies [c802946]
- Updated dependencies [4441ba5]
- Updated dependencies [93f3a28]
- Updated dependencies [768d28f]
- Updated dependencies [845528a]
  - @fbkworks/data@0.2.0
  - @fbkworks/adapter-core@0.2.0
  - @fbkworks/shared@0.2.0
  - @fbkworks/tokens@0.2.0
