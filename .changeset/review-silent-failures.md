---
"@fbk/components": minor
"@fbk/adapter-vant": minor
"@fbk/adapter-element-plus": patch
"@fbk/adapter-naive-ui": patch
"@fbk/adapter-core": patch
"@fbk/resolver": patch
---

修复一轮全仓库代码审查发现的静默失效缺陷

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

- **补齐 `@fbk/components` 的 4 个缺失子路径**：`crud-page` / `form-modal` / `result` /
  `detail-page` 及其 `style.css`，以及 `./styles/index.css`，此前均未进入 `exports`，
  消费者装到包后子路径导入直接 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
  `@fbk/resolver` 的自动导入映射同步补齐（5 → 9），两者本是同一份清单的两处漂移。

- **`FbkResult` 未知 `status` 不再崩溃**：`status` 是运行时字符串，后端返回 401 / 422
  时原代码读 `undefined.title`，整块白屏。现在回退到中性默认，合法数字码语义不变。
