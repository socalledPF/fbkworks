---
"@fbk/adapter-core": minor
"@fbk/adapter-element-plus": minor
"@fbk/adapter-naive-ui": minor
"@fbk/adapter-vant": minor
"@fbk/components": minor
---

新增 `Drawer` 原语与 `FbkDetailDrawer` 组件（P4-2）

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

| 适配器 | 实现 | 说明 |
|---|---|---|
| element-plus | `ElDrawer` | `ElDrawer` 只在**离场动画结束**后 emit `update:modelValue(false)`——动画被打断就永不发出，无 transitionend 的环境（jsdom）一次都不发。因此关闭意图改走 `beforeClose` 同步发出。副作用：EP 的抽屉是**纯受控**的，父级不接 `v-model` 就不会关，与另两家一致。 |
| vant | `van-popup position` | `van-popup` 没有 title 容器，自带的 `closeable` 只是图标且不发关闭事件，所以标题栏由适配器自绘（`fbk-vant-drawer__*`）。 |
| naive-ui | `NDrawer` | `NDrawerContent(title, closable)`。 |

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
