# 会话检查点：2026-10-25

> 这份文档的用途：把一轮长会话里形成的判断、踩过的坑、实测数字固化成可交接的状态，
> 让下一次会话不必重读几万行对话就能接手。
>
> **它不是设计稿。** 设计决策的论证在 `docs/design/*.md`，规范在 `docs/style-guide.md`，
> 优先级在 `docs/enterprise-architecture.md`。本文只回答三个问题：
> 现在在哪、为什么长这样、下一步是什么。
>
> 所有数字都是本轮实测（命令见「十、如何复现」），不是从旧文档抄的。
> 与旧文档冲突处已在「附录 B」列出——**冲突时以本文为准**。

| 项 | 值 |
|---|---|
| 快照时间 | 2026-10-25 23:07 +08:00 |
| 分支 / HEAD | `main` / `9af24ca` |
| 工作区 | 干净（`git status` 无改动；本文档本身是新文件） |
| 门禁 | `pnpm verify` 全绿，600 用例 / 44 个测试文件 |
| 提交总数 | 35（2026-10-18 起） |
| 未发布变更集 | 8 个（`.changeset/*.md`，README 除外） |

---

## 一、项目是什么

Vue 3 企业级业务组件库。**一套业务组件，三种 UI 适配器**：element-plus（桌面）、vant4（移动）、naive-ui（桌面）。

业务页面只依赖 `@fbk/adapter-core` 的契约，**代码里不出现任何 UI 库类型**。切换适配器只改应用入口的两行注入代码。

```
tokens ← shared ← adapter-core ← components
                        ↑
                    adapters
```

核心判断（也是整个项目的存在理由）：中后台的重复劳动不在「写 HTML」，在**约定**——
`request` 的形状、分页/排序/筛选的联动规则、空态与错误态的表现。组件库的价值是**把约定固化**，不是加宽覆盖。

## 二、仓库实测结构

21 个 workspace 包（另有一个根 `package.json`）：**12 个可发布** + 9 个私有（5 个内部工具包 + 3 个应用 + 1 个消费者测试）。

| 分组 | 包 |
|---|---|
| 核心 9 | `tokens` `shared` `adapter-core` `components` `chart-core` `dashboard` `screen` `data` `resolver` |
| 适配器 3 | `adapter-element-plus` `adapter-vant` `adapter-naive-ui` |
| 内部 5（私有） | `adapter-conformance` `test-utils` `build-config` `demos` `scripts-tests` |
| 应用 3（私有） | `docs`（VitePress）`playground`（三适配器调试台）`admin`（狗粮后台） |

关键规模：

| 项 | 数量 | 说明 |
|---|---|---|
| `components` 目录 | 10 个（9 组件 + `styles/`） | 9 个组件各有 `style.css` |
| demo 页面 | 15 个，分 6 组 | `packages/internal/demos/src/registry.ts` |
| `apps/admin/src` | 1929 行 | 其中 `pages/` 1140 行、7 个页面 |
| `apps/admin/src/mock/data.ts` | 275 行 | 用 `defineBackend` 声明后端惯例 |
| `docs/design/` | 10 份 | 其中 6 份是 2026-10-25 的 |

## 三、硬约束（违反即架构失效）

| 约束 | 执行方式 |
|---|---|
| **只有 `packages/adapters/**` 可以 import UI 库，包括 `import type`** | ESLint `no-restricted-imports` + dependency-cruiser 双重拦截 |
| 发布包禁止 13 个第一类运行时依赖 | `axios ky ofetch superagent vue-router pinia vuex vue-i18n dayjs moment lodash ramda date-fns` |
| `uiProps` 类型必须是 `Record<string, any>` | `check:surface` 扫描公开 `.d.ts`，禁止泄漏 UI 库类型 |
| `chart-core` / `dashboard` / `screen` **不依赖** `adapter-core` | 图表层与 UI 库无关，可独立使用 |

被 `check:runtime-deps` 与 ESLint 扫描的是 **8 个包**（上表核心 9 个减去 `resolver`）。
`resolver` 不在扫描范围，因为它零运行时依赖（`dependencies` / `peerDependencies` 都是空）。

**适配器边界规则**：只有当**交互模型随 UI 库变化**时才写适配器。
纯展示组件（`Descriptions`、`Result`）直接手写语义 HTML（`<dl>/<dt>/<dd>`），不进适配层——
多一层抽象只会让「换库」这个动作变贵，而换库本来就不该影响纯展示。

## 四、门禁流水线

`pnpm verify` = 14 步，顺序不可调（build 在前，产物检查在后）：

```
lint → lint:deps → typecheck → test → build → check:surface → check:styles
→ check:style-entries → check:runtime-deps → check:packages → check:types
→ check:consumer → check:diagrams → docs:build
```

不在 `verify` 里、但在 CI 里单独跑的两项：

| 项 | 为何独立 |
|---|---|
| `verify:data-contract` | 起真实 HTTP 服务验证契约，只在 Linux 跑（验逻辑，与平台无关） |
| `check:impact` | 只在 PR 上跑，`continue-on-error: true`——影响范围大不等于有问题 |

`check:impact` 的**退出码永远是 0**（脚本自身出错除外）。
如果影响大就卡 CI，团队会开始「为了过 CI 而拆小 PR」，反而让变更更难审查。

## 五、本轮做了什么

按提交时间倒序（35 个提交里与本轮相关的部分）：

| 提交 | 内容 |
|---|---|
| `9af24ca` | 修 `DetailPage` 漏透传 `bordered` / `direction` / `size` |
| `90b2ef2` | P4-1 `DetailPage` + P4-3 `options` 支持函数形式 |
| `0c89da7` | 修正 `defineBackend` 的论证与示例（去掉「省行数」的错误论据） |
| `3ea4bcf` | 新增 `defineBackend`，后端惯例只写一次 |
| `7f1024d` | 用真实 HTTP 验证契约对真实响应形状的适应性（45 条断言） |
| `4cab6e8` | P3-1 变更影响分析 |
| `c802946` | 按优先级修复架构审查发现的 5 项问题 |
| `cc7d68d` | 回退「极简组件 + 监控大屏重设计」（用户不满意那一版） |
| `9e15a73` | 落地契约层、权限三层与可观测性（P0/P1/P2） |
| `e0b159a` | Playground 重构为侧边栏布局 |
| `fa6b557` | 新增 `apps/admin` 后台管理系统 demo |

**P0-P2 全部落地**：契约层 `@fbk/data`、权限三层、可观测性统一出口。
**P3-1 落地**（原计划跳过，后按决策执行）。**P4-1 / P4-3 落地**，P4-2 待决策。

## 六、踩过的坑

这一节最值钱。按「症状 → 根因 → 修法」记录，同类问题不应再犯。

### 6.1 样式写了但没生效（两次，同类）

**症状**：`FormModal` 底部两个按钮紧贴，`gap` 完全无效。测试全绿、类型全对。

**根因**：每个组件的 `style.css` 必须登记到**两个入口**才生效——
`packages/components/src/styles/index.css`（全量引入者）和 `apps/playground/src/styles.ts`（开发评审）。
`form-modal` / `crud-page` / `result` 三个都没登记，实测 `gap` = 0px。

**修法**：两处入口都补，并新增 `scripts/check-styles.mjs` 把这个链路变成门禁。
教训写进了 `docs/style-guide.md`：**根因不是「写错了 CSS」，是「接入链路没有约束」**。

### 6.2 确认框按钮间距三家不一致

**实测**：element-plus **0px**、naive-ui **12px**、vant **0px**。

**根因**：element-plus 的 `.el-message-box__btns` 是 flex 但没有 `gap`；
naive 有 12px 但来自 CSS-in-JS 写在行内样式上的 `--n-action-space`。

**修法**：三个适配器的 `style.css` 各自补到 `gap: var(--fbk-spacing-sm)`（8px）。
naive 额外要把 `--n-action-space` 置 0——那个变量被 naive 用 CSS-in-JS 写在 `.n-dialog` 的**行内样式**上，
普通选择器改不动，只能用 `!important`（作用域限定在 `.n-dialog` 内，不影响消费方）。

### 6.3 `inheritAttrs: false` 却没 `v-bind="attrs"` —— **已修（2026-10-25 续）**

**症状**：给组件传 `class` / `style` 静默失效，无任何报错。

**根因**：组件声明了 `inheritAttrs: false` 却没手动转发 attrs。

**实测范围**（本轮用 `mount()` 验证，不是读代码推断）：

| 包 | 状态 |
|---|---|
| `dashboard`（7 个组件） | ✅ 正确转发（`useAttrs()` + `v-bind="attrs"`） |
| `screen`（10 个组件） | ✅ 正确转发 |
| `components` 的 `DetailPage` | ✅ 正确转发 |
| **`components` 其余 8 个** | ✅ **已修**：`crud-page` `descriptions` `form-generator` `form-modal` `page-container` `pro-table` `query-form` `result` |
| **`chart-core` 的 `FbkChart`** | ✅ **已修** |

实测证据（临时探针，已删除）：

```
Descriptions root = fbk-descriptions fbk-descriptions--gap-md   ← 期望含 from-outside
Result root       = fbk-result fbk-result--info                 ← 期望含 from-outside
```

**⚠️ 这里有一个必须记下的教训**：本轮早期版本的这份文档写的是「9 个组件全部补 `v-bind="$attrs"`」，
那是**错的**——我当时只 grep 了 `inheritAttrs: false` 的数量，就推断「都补过了」，没有验证转发是否存在。
被自己的实测推翻。

**为什么危险**：`inheritAttrs: false` 本身是**正确**的写法（组件需要控制 attrs 落在哪个元素上），
所以它看起来像「已经处理过了」。真正的判断标准是**有没有 `useAttrs()` 或 `v-bind="attrs"`**。

**修法**（2026-10-25 续已执行）：9 个组件各加 `const attrs = useAttrs()` 并绑到模板根元素。
`form-modal` 的根是 `<component :is="Dialog">`，attrs 绑在 **Dialog 这一层**（经用户决策）。

守卫：`packages/components/tests/attrs.spec.ts`（10 用例）与
`packages/chart-core/tests/attrs.spec.ts`（4 用例）表驱动覆盖两包全部组件导出，
漏转发会立刻变红。单点证伪已验证：只摘 `Result` 的 `v-bind` → 恰好 1 条红。

### 6.4 大屏缩放后整体偏移 24.5px

**根因**：`translate(-50%,-50%) scale(s)` 配 `transform-origin: top left`——
百分比 translate 先按**未缩放**尺寸算，随后被 scale 一起放大，位置就错了。

**正确顺序**：`scale(s) translate(-50%, -50%)`。代码在 `packages/screen/src/ScreenPage.vue:60`。

### 6.5 图表 canvas 高度 0

**两个独立原因叠加**：
1. flex 链上缺 `min-height: 0`，父容器不收缩
2. `chart-core/style.css` **从未被任何入口引入**

**修法**：`.fbk-chart__canvas` 改 `position: absolute; inset: 0`（脱离 flex 高度计算），
并把样式登记进入口。

### 6.6 ECharts 不认 CSS 变量

**症状**：`addColorStop` 收到 `var(--fbk-chart-1)` 直接抛错。

**根因**：ECharts 在 JS 里算颜色，拿不到 CSS 变量解析后的值。

**修法**：`resolveOptionVars()`（`packages/chart-core/src/color.ts:42`）深度遍历 option，
把 `var(--fbk-*)` 换成实际值。

### 6.7 `--fbk-chart-1` 卡在旧值

**根因**：`packages/tokens/src/index.ts` 的 `defaultTokens` 在运行时往 `:root` 注入变量，
压过了 CSS 里的值；同时 `dashboard` / `screen` 的 `dist/style.css` 内联了旧版 tokens 副本。

**修法**：改 tokens 后必须**一起重建** `tokens` → `chart-core` / `dashboard` / `screen`。
只重建一个包会拿到混合版本。

### 6.8 `FbkProvider` 的 `theme` prop 不是响应式的

**症状**：`<FbkProvider :theme>` 配 `v-model` 切换，界面纹丝不动。

**根因**：`props.theme` 只在 setup 时读一次，之后变化无人监听。

**修法**：`packages/adapter-core/src/plugin.ts:192-208` 为 `theme` / `locale` / `size` 各加一个 `watch`。

### 6.9 `v-permission` 指令没注册

**症状**：`Failed to resolve directive: permission`，但页面不报错，权限控制静默失效。

**根因**：`createBusinessKit` 在 `app.directive(...)` 注册了，但 `FbkProvider` 组件路径没注册。

**修法**：`plugin.ts:181` 通过 `getCurrentInstance().appContext.app.directive(...)` 补注册。

### 6.10 `total: null` 静默变成 0

**症状**：分页器显示「共 0 条」，实际有数据。

**根因**：`Number(null) === 0`。字段名写错或后端返回 null 时，用户看到的是「暂无数据」，
而不是「你的契约配错了」。

**修法**：`extractTotal` 对 `null` / `undefined` / `''` 一律抛 `FbkDataError`，
错误信息里给出替代写法（`total: (raw) => rows.length`）。见 `packages/data/src/path.ts:98`。

### 6.11 `DetailPage` 漏透传属性（本轮最后修的）

**症状**：`<FbkDescriptions bordered>` 有边框，`<FbkDetailPage bordered>` 完全没有。

**根因**：`DetailPage` 只透传了 `column` / `groups` / `emptyText`，漏了 `bordered` / `direction` / `size`。
Vue 对未知 prop 不告警——它被当成 attr 挂到根元素上，所以静默。

**修法**：补齐三个 prop（`DetailPage.vue:154-156`），加 5 条测试防复发。

**这类 bug 的共同特征**：静默发生，且只在**对比**时才发现。
你是因为先在 `descriptions/basic` 看到边框、再看详情页发现没有才注意到的。
只看详情页一个页面，不会觉得有问题。

### 6.12 构建期才报的 TS7022

**症状**：`CrudPage` 的 `useSlots()` 在 `build`（dts 生成）时报 TS7022 隐式 any，`typecheck` 却看不到。

**修法**：显式标注 `Record<string, unknown>`。

**教训**：`typecheck` 通过 ≠ `build` 通过。dts 生成的类型推断路径与 `vue-tsc --noEmit` 不完全一致。

### 6.13 包内自引用破坏 vitest

**症状**：`DetailPage.vue` 里 `import { ... } from '@fbk/components/page-container'`，vitest 解析失败。

**修法**：包内一律用相对路径（`../page-container`）。

### 6.14 环境坑（Windows）

| 坑 | 绕法 |
|---|---|
| `/tmp` 被重定向 | 用 `$TEMP` 或直接读 `C:\Users\...\AppData\Local\Temp` |
| `find /` 超时 | 用 `glob` 工具，不要扫全盘 |
| vite 文件锁 | 改文件前先 `pkill -f vite` |
| playground 端口每次重启都变 | 读启动日志里的 `localhost:PORT` |
| 缓存的旧 CSS | `rm -rf node_modules/.vite` 后重启 |

## 七、设计模式现状

**在用的**：

| 模式 | 位置 | 为什么需要 |
|---|---|---|
| 适配器（双向） | `adapter-core` 的 `Capabilities` + `ThemeBridge` | 一套组件跨三种 UI 库，且库之间能力不对等 |
| 策略 | 注入的 `fetch` / `onError` / `onTelemetry` | 请求实现与监控实现都属于调用方 |
| 模板方法 | `defineBackend` 复用 `createPageRequest` | 后端惯例固定，接口差异只是参数 |
| 注册表 | `registerFbkCharts` | 图表按需注册，避免全量打包 |
| 依赖注入 | `Symbol.for` 键 + noop 兜底 | 多实例安全，不引全局单例 |
| 观察者 | `ResizeObserver` / `MutationObserver` / `watch` | 尺寸与主题变化必须响应 |

**刻意不用的**：工厂、单例、装饰器、EventBus、Repository、MVC 分层、微前端、SSR。

理由统一：中后台不需要，且每加一层抽象都会让「换 UI 库」和「读懂一个页面」变贵。

**一个判断标准**：抽象是否值得，不看「省了多少行」，看**可审计性**——
改一处就不能漏掉另一处。按这个标准，`defineBackend` 从**第 2 个**列表接口起就值得，
而不是「3-4 个」——我上一轮说「3-4 个」是错的，用户纠正后改了论证。

## 八、关键实测值

### 间距与字号令牌

| 令牌 | 值 | 原语 |
|---|---|---|
| `--fbk-spacing-xs` | 4px | `--fbk-space-4` |
| `--fbk-spacing-sm` | 8px | `--fbk-space-8` |
| `--fbk-spacing-md` | 12px | `--fbk-space-12` |
| `--fbk-spacing-lg` | 16px | `--fbk-space-16` |
| `--fbk-spacing-xl` | 24px | `--fbk-space-24` |
| `--fbk-spacing-xxl` | 32px | `--fbk-space-32` |
| `--fbk-font-size-md` | 14px | `--fbk-fs-14` |
| `--fbk-radius-md` | 6px | `--fbk-radius-6` |

语义令牌指向原语：`--fbk-spacing-sm: var(--fbk-space-8)`。用语义名，一眼看出该用哪个。

### 主题

`ThemeMode = 'light' | 'dark' | 'cyber' | 'system'`（**4 个值**）。

`cyber` 不是明暗轴的第三个值，是**风格预设**（暗底 + 青色主色）。
混进同一个联合类型是为了让适配器的 `ThemeBridge` 保持两参数——
拆成 `mode` + `skin` 会让 provider 型库（naive-ui 只有 light/dark）无法表达。
`THEME_IS_DARK` 把 `cyber` 归到 `dark`。

### 契约层语义

| 场景 | 行为 | 理由 |
|---|---|---|
| 路径解析失败 | **抛错**，不返回空数组 | 静默返回空会让用户看到「暂无数据」，而真实原因是字段名写错 |
| `total` 为 `null` / `''` / `undefined` | **抛错** | `Number(null) === 0`，静默转换会显示「共 0 条」 |
| `isSuccess` 未传 | 视为成功 | 但**有业务码的后端必须传**，否则 token 过期会显示成空列表 |
| `AbortSignal` 中止 | 异常原样抛出 | `use-table-request` 依赖 `AbortError` 判断是否丢弃响应 |

`ProTable` 的契约类型是 `@fbk/data` 的**别名**，不重复定义：

```ts
export type TableRequestParams = PageQuery
export type TableResponse<T> = Omit<Page<T>, 'total'> & { total?: number }
```

唯一语义差异：`TableResponse.total` 可选，`Page.total` 必填。

## 九、未完成与待决策

| 项 | 状态 | 阻塞点 |
|---|---|---|
| **P4-2 详情抽屉** | 待决策 | 抽屉 vs 页面跳转，需要产品口径（**唯一有实质内容的剩余项**） |
| 8 个变更集未发布 | 待决策 | 发布节奏由用户定，`.changeset/` 已备好 |
| `request-adapters` | 明确不做 | 用户决策跳过 |
| 角色 → 权限点映射 | 不做 | 那是应用的用户体系，库不该知道 |

**P4 剩余项没有排期**。P4-1 / P4-3 已落地，P4-2 是唯一有实质内容的剩余项。

## 十、如何复现本文所有数字

```bash
pnpm verify                # 14 步门禁，600 用例
pnpm check:styles          # 9 个组件样式均已接入
pnpm check:style-entries   # 9 个包 / 3 个应用入口
pnpm check:impact          # 变更影响分析（退出码永远 0）
pnpm verify:data-contract  # 起真实 HTTP，45 条断言
```

单独看某个数字：

```bash
git log --oneline | wc -l                              # 35
ls .changeset/*.md | grep -v README | wc -l            # 8
find packages tests -name '*.spec.ts' -not -path '*/node_modules/*' | wc -l   # 44
grep -c "group:" packages/internal/demos/src/registry.ts                      # 15
```

## 十一、协作约定

**用户明确要求过、必须遵守的两条**：

1. **每一次做样式设计，必须先出 UI 设计稿，再实现。**
   直接改代码 = 返工。上一轮我跳过设计稿做「极简 + 监控大屏」重设计，被要求整体回退（`cc7d68d`）。

2. **样式类结论必须实测，不能靠读代码。**
   用 Playwright 量计算样式、截图对比，再下结论。
   我上一轮说「已统一」，实际只统一了大项——用户当场发现。

**验证纪律**：`pnpm verify` 全绿 + 浏览器实测 + 截图，三者都过才算完成。

**demo 里的原生按钮是有意为之**：`fbk-demo-btn` / `admin-btn` 类名保持原生 `<button>`，
不用 `<FbkButton>`——被测试的组件不能同时充当脚手架。

---

## 附录 A：与压缩摘要的事实核对

本文档由会话压缩摘要（compaction checkpoint）整理而来。
摘要里的数字有几处与仓库实际不符，逐条核对如下。**正文已按实测值写，此处保留差异记录。**

| 摘要原文 | 实测 | 命令 |
|---|---|---|
| 「10 published packages」 | **12 个可发布**（9 核心 + 3 适配器） | 扫全部 `package.json` 的 `private` |
| 「`PUBLISHED_PACKAGES`（9，含 `packages/data`）」 | **8** | 解析 `eslint.config.mjs` |
| 「`check-runtime-deps.mjs` 的 `PUBLISHED` 列表 9 个包」 | **8** | 解析脚本常量 |
| 「`.changeset/` 有 6+ 个未发布变更集」 | **8** | `ls .changeset/*.md` |
| 「`mock/data.ts`（227 行）」 | **275 行** | `wc -l` |
| 「Themes: light, dark, cyber」 | **4 个值**，含 `system` | `contracts/theme.ts` |
| 「`docs/design/` 记录含 `2026-10-21`」 | 该文件**从未存在** | `git log --diff-filter=A` |
| 「记录含 `-minimal-and-monitoring-redesign.md`（已回退）」 | 该文件随 `8019804` 加入、随 `cc7d68d` 删除，**当前不存在** | 同上 |
| 「`extractTotal` 对 null / `''` 抛错」 | 还包含 **`undefined`** | `path.ts:98` |
| 「45 assertions」 | **45** ✓ | `grep -c "check("` |
| 「600 tests」 | **600 / 44 文件** ✓ | `pnpm test` |
| 「15 demos」 | **15** ✓ | `grep -c "group:"` |

## 附录 B：仓库里已发现的过期文档（已修）

写这份文档时顺手发现的，**已于 2026-10-25 续修完**（下表 4 项全部落地）：

| 位置 | 问题 |
|---|---|
| `docs/enterprise-architecture.md:13-14` | P3 写「按决策跳过」、P4 写「等 P0-P2 稳定后评估」，实际 P3-1 与 P4-1/P4-3 均已落地 |
| `docs/enterprise-architecture.md:18` | 「`apps/admin` 1598 行业务代码」，实测 **1929 行** |
| `docs/enterprise-architecture.md:146` | 「512 用例」，实测 **600** |
| `docs/design/2026-10-25-fbk-data-contract.md:3` | 引用了**不存在**的 `docs/design/2026-10-25-enterprise-architecture-plan.md`，应指向 `docs/enterprise-architecture.md` |

这些不影响门禁（`docs/` 不在 VitePress 构建范围，也没有 markdown lint），
但会让下次接手的人读到错的状态——已全部修正。

---

## 附录 C：2026-10-25 续（attrs 转发 + 文档修正）

| 项 | 结果 |
|---|---|
| 9 个组件补 attrs 转发 | ✅ `components` 8 个 + `chart-core` 1 个 |
| 回归守卫 | ✅ 两个表驱动 `attrs.spec.ts`，共 14 用例 |
| 附录 B 的 4 处过期文档 | ✅ 全部修正 |
| 变更集 | ✅ `.changeset/attrs-inherit-forwarding.md`（patch × 2），总数 8 → 9 |
| 门禁 | ✅ `pnpm verify` exit 0，**614 用例 / 46 个测试文件** |

### 本轮新增的坑

**C1. HTML 注释写在 `<template>` 根节点上方 → Vue 判定为多根 fragment → attrs 再次丢失。**
根因：`<template>` 里只要出现两个顶层节点（注释也算），就不再是单根，`attrs` 无处自动落地。
修法：说明性注释写进 `<script>`，不要放在模板根节点上方。

**C2. `pnpm verify` 「全绿」不等于「零错误」。**
`@fbk/components` 的 dts 构建**一直**打印 5 个 TS7022/TS7024（`DetailPage.vue` ×4、`FormModal.vue` ×1），
但 `vite build` 仍然 exit 0，所以 `verify` 照样通过。已在干净 HEAD 树上复现，确认是既有问题、非本轮引入。
这正是 §6.12 那个坑的另一面：**`typecheck` 通过 ≠ `build` 无错**，且 `build` 的报错还未必拦得住门禁。

**C3. PowerShell `Get-Content | Measure-Object -Line` 数行数不可靠。**
对 `apps/admin/src` 实测得 **1667**，真值 **1929**（`find | wc -l` 与 Node 换行计数双重确认）。
该 cmdlet 在多文件管道下按批统计、且不数空行。**数行数用 `wc -l`。**

**C4. `win_bash` 是持久 shell，`cd` 会残留。**
一次 `cd packages/components` 之后的命令全在错误目录下执行，`npx vitest run` 因此报 17 failed 的假象。
每次命令都显式 `cd <repo root> &&` 前缀。

---

## 附录 D：全仓库代码审查（2026-10-25 续，第二轮）

> 上一轮（附录 C）修的是 attrs 转发与文档过期。这一轮是**整体代码审查**：
> 7 个独立审查者按子系统并行读完全部 19 个有 src 的包，产出 26 项确认缺陷，
> 分六批修复并提交。门禁从 614 用例 / 46 文件到 **723 通过 + 1 skipped / 64 文件**。

### D.1 三类问题，一个共同病根

| 类别 | 数量 | 例子 |
|---|---|---|
| 声明与实现脱节 | 11 | 死 prop、`options.append` 声明不读、`notification` 能力没有 API、`register.ts` 误标已注册 |
| 门禁假绿 | 6 | 不在 CI、硬编码名单、运算符优先级 bug、恒真断言、豁免架空 |
| 无兜底 | 5 | Result 越界 status 白屏、ProTable 失败显示「暂无数据」、Date 被熔毁 |

**病根不是写错了，而是没有机制保证「声明的东西被实现」。**
类型检查只保证声明被类型兼容，不保证被读取；门禁只保证已有断言成立，
不保证新行为被覆盖。两者合力，让「声明与实现脱节」成为唯一不被拦截的缺陷类型。

**至少 4 处的注释当时就写明了问题，但代码没改**：
`feedback.ts` 说「能力声明了但契约里没有」、`plugin.ts` 说「用局部指令避免覆盖」
（代码是全局）、`vant/DatePicker.tsx` 说「静默丢时分比报错更糟」（然后丢了）、
`check-runtime-deps.mjs` 说「与 workspace 对应」（硬编码 8 个）。

### D.2 最严重的五项（都已修）

1. **`@fbk/components` 的 exports 缺 4 个组件** —— 消费者装到包后子路径导入直接
   `ERR_PACKAGE_PATH_NOT_EXPORTED`。admin 与 demos 靠 vite alias 直连 src 才活着。
2. **发版会发出装不上的包** —— `publish-all.mjs` 的 ORDER 只有 8 个包，
   而 `@fbk/components` 依赖 `@fbk/data`，data 从未上架。
3. **无限滚动一次触底发两个请求**，第一页数据被覆盖，且因竞争表现为「偶现」。
4. **vant 把用户选的时分静默改写成 `00:00:00`**（`time` 类型），daterange 只取第一个值。
5. **`v-permission` 多实例互踩** —— `app.use` 配好权限后再套 `<FbkProvider>`，
   按钮成片消失；且绑定值变化后 DOM 不更新。

### D.3 门禁的三层失效

这是本轮最重要的结构性发现，**同一个缺陷能穿三层**：

1. **不在 CI**：`check:styles` / `check:style-entries` / `check:runtime-deps`
   在 `verify` 里但 CI 只跑 12 步。而 `style-guide.md` 称 `check:runtime-deps`
   为「最关键的一道」。
2. **在但防不住**：`check-styles` 的 `baseSelector` 把修饰符全剥掉，恰好豁免了它
   该抓的失败；`check-style-entries` 的运算符优先级把 vant/naive 静默排除；
   `check-runtime-deps` 硬编码 8 个包，注释却声称与 workspace 对应。
3. **覆盖面错**：`check-style-entries` 把路径映射到 `src` 而非 `exports`，
   `isCovered` 对 `@fbk/components/` 前缀一律放行 —— 这两条让 F6 长期无人发现。

**教训：靠人工维护的清单一定会漂移。** 本轮在三处独立证明
（`PUBLISHED` / `publish-all` 的 ORDER / changeset 的 `fixed` 分组），
修法一律改成从文件系统发现 + 启动前自我校验。

### D.4 测试可信度的两个盲区

- **组件测试全部跑在 `createMockAdapter` 上**，48 处断言依赖只存在于 mock 的
  `data-fbk-part` 标记（mock 26 处 / element-plus 1 处 / naive 0 处 / vant 4 处）。
  这些断言在真实适配器上会全部失败。但注意：**本轮修的 P0 没有一项是它导致的**
  —— loadMore、错误态、插槽命名都是与 UI 库无关的编排逻辑。真正的盲区是
  「编排逻辑几乎无行为测试」，而不是「没用真实适配器」。
- **恒真断言**：`desktop-parity` 的类名集合比较（两边都是 `[]`）、
  conformance 的 loading 态（只断言 `html()` 非空）、确认框间距（对整份 CSS 做
  `toContain`，被同文件别处满足）。已重写并做过变异实验。

### D.5 本轮新增的坑

**D5.1 `<script setup generic>` 里的类型别名会被 dts 内联成坏路径。**
在 `defineEmits` 里用 `TableRequestParams`（= `PageQuery`）时，dts 生成器把别名
展开成 `import('packages/data/dist')`，`check:consumer` 立刻报 TS2307。
改为直接取 `@fbk/data` 的具名类型。**这类问题只有跑 build 才暴露**。

**D5.2 `perl` 在本机不存在，用 `sed` 批量替换同名标识符会制造递归。**
把 `function createAdapter()` 替换成 `createMockAdapter` 时，函数体内部的
`createAdapter()` 调用也一起被替换 → 函数自我递归。**批量替换在定义处与调用处
同名时会静默制造递归。**

**D5.3 `win_bash` 是持久 shell，`cd` 会残留。**
一次 `cd packages/components` 之后的命令全在错误目录执行，`npx vitest run`
因此报 17 failed 的假象。每条命令显式 `cd <repo root> &&` 前缀。

**D5.4 jsdom 不实现 CSS 特异性**（只按文档顺序取胜者，
`style-rules.js:177-178`）。所以 `getComputedStyle` 在 jsdom 里**无法证明**
「主题样式压过注入的基础样式」这类断言。需要按级联规范自行求解，
或用真实浏览器（本轮用 Chromium + CDP 实测过一次）。

### D.6 仍待决策

| 项 | 阻塞点 |
|---|---|
| **A8** `update:sort` 的 `field` 取 `key` 还是 `dataIndex` | element-plus 取 dataIndex、naive 取 key。已用 `sort-field-a8.spec.ts` 钉住现状，收敛后删该文件 |
| **vant 移动端排序入口** | 卡片列表无表头，需产品方案（下拉 / 筛选栏 / 顶栏菜单）。当前 `skip: ['sort']` |
| `<FbkProvider>` 在 element-plus 下多一层 div | 无预设样式；若布局依赖 `height: 100%` 链需自行补高度 |
| **样式四项** | F20 饼图选择器失配、`check:styles` 的豁免与扫描范围、18 处硬编码间距、639/640 断点混用 —— 按项目约定需先出设计稿 |
| P4-2 详情抽屉 / 9 个变更集的发布节奏 | 上一轮遗留 |

### D.7 审查方法本身的两个教训

1. **审查报告是证据，不是结论。** 本轮至少三次，报告的主张与实测不符：
   「三个适配器都不读 size」（element-plus 其实读了）、
   「`FbkProvider` 丢 attrs」（真实断点在三个 RootProvider）、
   「两个 attrs.spec.ts 是探针文件」（是 118/138 行的真实测试）。
2. **验证断言要验证「它能不能抓到问题」，而不是「它是否通过」。**
   `desktop-parity` 那两条恒真断言在施加两个变异后仍 16/16 全绿 —— 这才是它们
   恒真的证据。只看绿灯永远发现不了。

