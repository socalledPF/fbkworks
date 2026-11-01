# 架构与依赖规则

::: tip 先看设计图
分层图、依赖方向图、注入时序图、请求竞态时序图、DataGrid 表现层分流图都在
[架构总览（含设计图）](/guide/architecture-diagrams)。这一页只讲规则与落地方式。
:::

## 目录结构

```text
packages/
├─ tokens/                    设计令牌
├─ shared/                    无 UI 语义工具
├─ adapter-core/              契约 / 注入 / 能力声明 / 主题桥
├─ adapters/
│  ├─ element-plus/
│  ├─ vant/
│  └─ naive-ui/
├─ components/                业务组件（单包 + 子路径导出）
├─ resolver/                  可选：unplugin-vue-components 解析器
└─ internal/
   ├─ adapter-conformance/    适配器契约测试套件
   ├─ test-utils/             mock adapter
   ├─ build-config/           共享 Vite 配置
   └─ demos/                  文档与 Playground 共用的 demo
```

## 依赖规则

| # | 规则 | 落地方式 |
|---|---|---|
| 1 | 只有 `packages/adapters/**` 可以 import UI 库，**含 `import type`** | ESLint `no-restricted-imports` + dependency-cruiser |
| 2 | `components` 只能依赖 `adapter-core` / `shared` / `tokens` | 同上 |
| 3 | `adapters` 禁止反向依赖 `components` | 同上 |
| 4 | 公开 `.d.ts` 不含 UI 库类型 | `scripts/check-type-surface.mjs` |
| 5 | 组件 CSS 只用 `--fbk-*` 与 `.fbk-*` | Stylelint（P2） |
| 6 | 组件不依赖 vue-router / axios / dayjs | ESLint |
| 7 | 禁止循环依赖 | dependency-cruiser |

验证：

```bash
pnpm lint        # ESLint 边界规则
pnpm lint:deps   # dependency-cruiser 依赖图
pnpm check:surface
```

手工反例（应当两个门禁都报错）：

```ts
// packages/components/src/descriptions/types.ts
import type { TableProps } from 'element-plus'
```

## 原语与可选层

**业务组件不直接 import UI 库**（见上表规则 1），只通过 `adapter.primitives.X` 渲染。
这条约束换来了「换适配器只改注入」这句话的可信度。

原语分两层，判据是「**缺了之后，主要使用场景还能不能交付**」：

| 层 | 缺失后果 | 由谁管 |
|---|---|---|
| **必填**（13 个） | 启动即失败，整个适配器不可用 | `assertAdapterCompatible` |
| **可选** | 只有用到它的那个组件不可用，库的其余部分正常 | `requirePrimitive`，在用点报错 |

判断一条新原语该进哪层，问三个问题：

1. 缺了它，列表 / 查询 / 表单 / 详情还能不能做？
2. 同一用户需求有没有**官方的、完整的**替代路径？
3. 缺失时能不能**大声报错并给出替代方案**？

三条都满足才进可选层。注意**替代 ≠ 降级**：

- 替代：缺了抽屉 → 改用 `FbkDetailPage` 整页展示，功能完整
- 降级：缺了日期选择器 → 退化成文本框，看起来能用、行为不同

本项目明确反对降级，所以只有 `Drawer` 落在可选层——缺了可改用 `FbkDetailPage`，
其余 13 个缺了都只能是降级。

### 缺可选原语时会发生什么

`FbkDetailDrawer` 在 mount 阶段抛错，**不会**渲染成别的东西：

```
[fbk] 适配器「xxx」没有提供 Drawer 原语，该组件不可用。
可改用 FbkDetailPage，以整页形式展示同样的内容。
```

### 能力位必须与实现一致

`capabilities.overlay.supportsDrawer` **必须等于** `Boolean(primitives.Drawer)`，
一致性套件会断言这一点。否则就是两个真相源：能力位说支持、实际拿不到组件。

## 注入键为什么用 `Symbol.for`

```ts
export const ADAPTER_CONTEXT = Symbol.for('fbk.adapter.context')
```

pnpm 的严格 node_modules 结构下通常只有一份 `adapter-core`，但微前端、npm link、多版本共存都可能产生两份。
用普通 `Symbol()` 时两份模块的 key 不相等，`inject` 直接失败；`Symbol.for` 走全局注册表，跨模块实例也能命中。

## 契约版本

```ts
export const ADAPTER_API_VERSION = 3
```

`createBusinessKit` 启动时校验 `adapter.meta.apiVersion`。
所有发布包用 Changesets `fixed` 锁步版本，避免 `adapter-core@0.3` 配 `adapter-vant@0.1` 的错配。

### 什么时候该升版本号

> **升 ⟺ 已有原语的 props / 事件 / expose 发生了不兼容变化。**

版本号只管「**改坏已有**」，不管「**新增有无**」：

| 变更 | 是否升 | 为什么 |
|---|---|---|
| 新增原语（且设为必填） | **升** | 旧适配器缺这个成员 → 启动即失败 |
| 新增原语（放进可选层） | 不升 | 缺了只是那个特性不可用，不用它的人毫无影响 |
| 必填改为可选 | 不升 | 更宽松的约束，已有适配器全部仍然通过 |
| 移除原语 | 不升 | 校验是**超集检查**（`required` 里的键必须存在），多出来的会被忽略 |
| 改某个原语的 props 形状 | **升** | 已有实现会静默错位 |

判据一句话：**新增原语会破版（旧适配器缺成员），减少约束不会。**

这也正是「可选层」存在的理由——它让「加一个新能力」不必再破一次版。
历史上 v2（DatePicker / Radio）、v3（Drawer）都是纯新增，却都被迫升了版本号。

## 能力声明

```ts
adapter.capabilities.dataGrid.selection   // false 时不渲染选择列
adapter.capabilities.pagination.mode      // 'pages' | 'infinite' | 'both'
adapter.capabilities.theme.provider       // naive-ui 为 true，必须走 FbkProvider
```

业务组件按能力降级，而不是假设三库能力一致：

```ts
const isInfinite = computed(() => adapter.capabilities.pagination.mode === 'infinite')
```

## 构建与发布

- **ESM-only**：首期不做 CJS。双格式需要 `.d.cts`、双包风险与 attw 复杂度，企业内 Vite / Webpack5 消费 ESM 无障碍。
- **`preserveModules`**：产物文件多，但跨入口共享代码只保留一份，堆栈直接对应源码。
- **样式独立文件**：禁止 SFC `<style>`。Vite lib mode 多入口 + preserveModules 下 CSS 抽取路径不稳定；显式导入让按需样式完全可控。
- **`sideEffects: ["**/*.css"]`**：JS 保持可摇。
- **d.ts 说明符**：构建后把 `./x` 改写成 `./x.js`，否则 node16/nodenext 消费者解析失败（`attw` 会直接报 `InternalResolutionError`）。

## 测试分三类

1. **纯逻辑单测**：`shared`、`adapter-core` 工具、`useTableRequest`。
2. **适配器契约测试**：`@fbkworks/adapter-conformance` 提供一整套契约断言
   （`apiVersion` 兼容、能力合法且与实现一致、各原语的 v-model / 事件 / attrs 透传、
   选择与排序、`presentation=cards`、Drawer 行为……），每个适配器一行接入。
   **用例清单一律以 `runAdapterConformance` 源码为准，本文不重复具体条数**
   —— 这里的旧数字曾长期停留在 15，而实际已是 24。
   三个适配器跑同一套断言，保证"换适配器只改注入"这句话是真的。
3. **业务组件测试**：用 mock adapter，只测语义，不测 UI 库 DOM。

```ts
runAdapterConformance({
  adapter: vantAdapter,
  mount: (component, props) => mountWithProvider(component, { adapter: vantAdapter, props }),
  selectors: { row: '.fbk-vant-grid__card', selection: '.fbk-vant-grid__check' },
})
```

## 设计决策记录

规则背后的「为什么」记在 `docs/design/` 下，**不随文档站发布**（它们是决策记录，不是使用手册）。
改到相关模块前建议先读：

| 主题 | 文档 |
|---|---|
| 适配器分层与可选原语 | [2026-10-28-optional-primitive-layer.md](https://github.com/socalledPF/fbkworks/blob/main/docs/design/2026-10-28-optional-primitive-layer.md) |
| 图表 option 为什么只抽零件 | [2026-10-28-chart-option-extraction.md](https://github.com/socalledPF/fbkworks/blob/main/docs/design/2026-10-28-chart-option-extraction.md) |
| 架构改造的四项提案 | [2026-10-28-architecture-improvements.md](https://github.com/socalledPF/fbkworks/blob/main/docs/design/2026-10-28-architecture-improvements.md) |
| 大屏图表布局与间距 | [2026-10-28-screen-pie-layout-and-spacing.md](https://github.com/socalledPF/fbkworks/blob/main/docs/design/2026-10-28-screen-pie-layout-and-spacing.md) |
| 详情抽屉 | [2026-10-28-p4-2-detail-drawer.md](https://github.com/socalledPF/fbkworks/blob/main/docs/design/2026-10-28-p4-2-detail-drawer.md) |
