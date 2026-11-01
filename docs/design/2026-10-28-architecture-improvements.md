# 方案稿：从「修缺陷」转向「消灭缺陷类别」

> 本文不修任何东西，只回答一个问题：**这一轮审查暴露的 26 个缺陷，哪些是结构造成的？**
>
> 结论是：**11 个属于同一类——「声明与实现脱节」**，而它们的共同根源是
> **同一份事实被手工抄写了多遍**，且**没有任何机制把声明与实现绑在一起**。
>
> 所以这里提的不是「再修 11 个 bug」，而是「让这一类 bug 写不出来」。

---

## 一、证据：同一份事实，抄了四遍

组件清单（9 个组件）在四个地方被手工维护：

| 位置 | 形态 | 数量 |
|---|---|---|
| `packages/components/src/styles/index.css` | 手写 `@import` 清单 | 9 条 |
| `apps/playground/src/styles.ts` | 手写 `import` 清单 | 9 条 |
| `packages/resolver/src/index.ts` | 手写组件 → 子路径映射 | 9 条 |
| `tests/consumer/consumer.ts` | 手写 import | 20 处 `Fbk` 引用 |

三份 vite 配置各维护一份 alias：

| 应用 | alias 条数 | 用 `build-config` 吗 |
|---|---|---|
| `apps/playground` | 19 | ❌ |
| `apps/docs` | 15 | ❌ |
| `apps/admin` | 12 | ❌ |

**这不是理论风险，它在本次会话里兑现了三次**：

1. `vitest.config.ts` 缺 5 个包的 alias → CI 报 `Failed to resolve entry for package @fbkworks/chart-core`
2. `tsconfig.base.json` 缺 4 个包的 paths → `typecheck` 在无 dist 环境下失败
3. `apps/docs` 缺 4 个包 **+ 适配器的 `style.css` 子路径规则**（playground 有、docs 没有）

而 `check:styles` / `check:style-entries` 是**事后校验**——它们甚至会给出假绿
（`isCovered` 曾对 `@fbkworks/components/` 前缀一律放行，让 exports 缺 4 个组件的缺陷长期无人发现）。

---

## 二、提案 A（最高优先）：把手工清单换成生成

### A1. `styles/index.css` 由文件系统生成

现在：新增组件要在 `styles/index.css` 手加一行 `@import`。
漏了 → 组件样式不生效，测试全绿，肉眼全坏（这正是 §6.1 记录的原始事故）。

**改法**：新增 `scripts/gen-style-index.mjs`，扫 `packages/components/src/*/style.css`
生成 `styles/index.css`；作为 `prebuild` 与 `check:styles` 的一部分运行，
文件头加 `/* 由 scripts/gen-style-index.mjs 生成，勿手改 */`。

**验收**：删掉生成文件后跑 `pnpm build`，文件被重建且内容与之前逐字节一致；
手工改它会被 `check:styles` 判定为过期并报错。

### A2. `resolver` 的映射由 `components` 的导出生出

现在：`resolver/src/index.ts` 手写 9 条 `{ name, from, sideEffects }`。
新增组件忘了加 → 自动导入静默失效（本轮修过一次，5 → 9）。

**改法**：构建期扫 `packages/components/src/index.ts` 的 `export { Fbk* }` 与
目录结构，生成映射表；`packages/components/package.json` 的 `exports` 同样由它派生。

**验收**：往 `components/src` 加一个组件的目录与导出后，不手工改任何清单，
`resolver` 的映射与 `exports` 里自动出现它；`tests/consumer` 能导入它。

### A3. 三个应用共用「别名生成函数」

现在：三份 alias 各自演化，**漏的地方不一样**。实测漂移：

| 应用 | 缺什么 | 后果 |
|---|---|---|
| `apps/playground` | `chart-core` / `dashboard` / `screen` / `data` / `tokens/cyber.css` | 改这些包的 src 看不到变化 |
| `apps/docs` | 4 个包 **+ 适配器的 `style.css` 子路径规则** | `docs:build` 在无 dist 时失败 |
| `apps/admin` | `data`（它**确实 import 了**） | 全新克隆下 `pnpm dev` 解析失败 |

#### 不共用「配置文件」，共用「别名数组」

关键区别：

- **可以推导的**（哪个包在哪、用什么名字）→ 必须由仓库结构推导，**不给逃生舱**
- **应用固有的**（端口、适配器选择、VitePress 的 themeConfig）→ 各自保留

而且 VitePress 的 config 里有 `vite: { resolve: { alias } }`（`config.mts:84`），
所以**同一个别名数组可以直接喂给 docs**，不需要为它特殊处理。

#### 推导规则：读 `exports`，不硬编码约定

对每个包的 `package.json` 的 `exports` 逐项处理：

| export 形态 | alias 目标 |
|---|---|
| `"./dist/index.mjs"` | `src/index.ts`（`dist/`→`src/`，`.mjs`→`.ts`） |
| `"./dist/x/index.mjs"` | `src/x/index.ts` |
| `"./dist/css/tokens.css"` | `src/css/tokens.css`（`.css` 保持） |
| `"./src/index.ts"`（demos 已经指向源码） | 原样 |
| `"./package.json"` | 跳过 |

这样 `tokens/css`、`tokens/cyber.css`、`demos/style.css`、`components/<子路径>`
全部自动覆盖，**不为任何包写特例**。

#### 逃生舱三级

1. **追加**：`[...createWorkspaceAliases(o), ...应用特有]`
2. **前置覆盖**：Vite alias 顺序匹配、先命中生效，应用把覆盖项放在展开之前即可
3. **`overrides` 参数**：某包产物布局不遵循 `dist ↔ src` 同构时才用，且只针对那一个包

#### 判断标准

> **分叉的是「应用独有的东西」→ 允许，写在应用自己的配置里。**
> **分叉的是「对同一份仓库结构的重复描述」→ 不允许，必须推导。**

#### 代价与验收

生成器成为新的单点：**它写错，三个应用同时坏**。所以验收要更硬：

1. 生成结果必须**覆盖当前三份手工配置的并集**（逐条比对）。
2. 证伪：新增一个包 → 不改任何应用配置，三个应用都能 `import` 它。
3. 证伪：删掉某包 `exports` 的某一项 → 生成器不产出那条，且构建该应用时若真引用了会明确报错。
4. `pnpm verify` 全绿，三个应用的 vite 配置各自缩减到 15 行以内。

---

## 三、提案 B：让能力位与实现绑定

### 现状

`Capabilities` 是**手写布尔值**。本轮修掉的实例：

- `feedback.notification = true`，但 `FeedbackApi` 里没有这个成员
- `feedback.loading = true`，同上
- `vant` 的 `dataGrid.sort = 'custom'`，但全文没有一处 `emit('update:sort')`
- `mock-adapter` 同样声明了 sort 却发不出事件

类型系统只保证「声明被类型兼容」，**不保证「声明被实现」**。

### 改法（两条，可独立）

**B1（零成本）：双向校验脚本。**
扩展 `check:surface` 或新增 `check:capabilities`：
对每个适配器，断言「`Capabilities` 中为 `true`/`'custom'` 的每一项，
在 `adapter` 对象上真有对应实现」。这条能在编译之外拦住绝大多数本类缺陷。

**B2（更彻底）：能力位由 conformance 推导。**
conformance 套件已经是「某原语必须做到什么」的可执行定义。让 `capabilities`
从它派生，或至少在构建期交叉校验。成本高于 B1，但能连「实现存在但行为不对」也覆盖。

**验收**：把任意一个能力位改成 `true` 而不实现 → 门禁红。

---

## 四、提案 C：`ADAPTER_API_VERSION` 的双层模型

### 现状

`Drawer` 是第三次触发：新增一个原语 → 三个适配器各实现 → **版本号必升** →
第三方适配器全部失效。

这个模型把「新增能力」与「破坏兼容」绑死了。库继续长，版本号就会不断升。

### 改法

把 `UiPrimitives` 拆两层：

```
核心必填（Button / Input / Form / DataGrid / Pagination / Dialog / Tag / Empty / Spin）
    → 由 ADAPTER_API_VERSION 管，升版 = 破坏

可选能力（Drawer / 未来的一切新增）
    → 能力位 + 运行时显式降级
```

组件层对可选能力做一次**显式降级**（例如没有 `Drawer` 就渲染整页并告警一次）。

**这不是「静默降级」**——项目反对的是「用户以为能用、实际表现不同」。
关键在于降级必须**显式**：有 `warnOnce`、有测试、文档写明。

**代价**：每个可选能力都要设计降级路径，工作量大于「必填」。
**收益**：新增能力不再破版；第三方适配器可以只实现核心 + 自己需要的可选能力。

---

## 五、提案 D：图表 option 下沉到 `chart-core`

### 现状

| 包 | 组件 | 行数 |
|---|---|---|
| `dashboard` | BarChart / TrendChart / PieChart | 105 + 101 + 101 |
| `screen` | ScreenBarChart / ScreenLineChart / ScreenPieChart | 77 + 99 + 84 |

六份组件共 567 行，其中 `grid` / `legend` / `xAxis` / `yAxis` 的配置**平行重复**
（审查实测：4 处平行、`var(--fbk-chart-N)` 公式 7 处）。

而 `chart-core` 本来就是它们的共享层，且它内部已经有 `resolveOptionVars`、
`registerFbkCharts`、主题解析。

### 改法

把 option 构建下沉到 `chart-core`，导出 `buildCartesianOption` /
`buildPieOption` 之类的纯函数；`dashboard` 与 `screen` 各自只保留**皮肤差异**
（字号、间距、是否带四角装饰）。

**验收**：两个包的图表组件行数各减少一半以上；同一份数据在两个包里渲染出的
option 除皮肤字段外完全一致（可用快照测试钉住）。

---

## 六、刻意不做 / 需要你决策

| 项 | 判断 |
|---|---|
| **把 `fixed` 组（12 个包）拆成独立版本** | **需要你决策**。现在任何小改都会让全部 12 个包升版，消费者无法从版本号看出哪个包真变了。替代方案是独立版本 + 一个 `@fbkworks/kit` 元包锁定兼容组合。代价是发布流程复杂度上升。 |
| **浏览器级视觉回归进 CI** | **建议做，但不在这份稿里**。`scripts/visual/` 有 4 个脚本一个都不在 CI，而本轮饼图 bug 只能在浏览器里发现。需要先定「用 Playwright 还是现有 Python 脚本 + 截图基线」。 |
| **`components` 的公开类型 re-export `data`** | **暂不动**。`TableRequestParams = PageQuery` 目前是合理的（data 是更底层的契约层），只要在文档里写明「data 的分页契约是组件库 ABI 的一部分」即可。 |
| **改 `Fbk*` 前缀 / `fbk-*` 类名** | **不做**。它们是公开 API 与样式契约，改了才是破坏性变更，且与 npm 作用域无关。 |

---

## 七、建议的执行顺序

| 顺序 | 项 | 理由 |
|---|---|---|
| 1 | **A3 应用共用 vite 配置** | 成本最低，本次会话已在同一问题上往返三次 |
| 2 | **B1 能力位校验** | 一个脚本，拦住本轮最大一类缺陷 |
| 3 | **A1 + A2 生成式清单** | 消灭「手工登记必漏」这一类，与 A3 同一套思路 |
| 4 | **D 图表 option 下沉** | 纯重构，有快照测试兜底，风险可控 |
| 5 | **C 双层契约** | 影响面最大，需要单独一轮设计与迁移方案 |

前三项的共同特征：**它们消灭的不是某个 bug，而是「这一类 bug 能被写出来」的可能性。**

---

## 八、整体验收标准

1. `pnpm verify` 仍全绿，且**步骤数不减少**（改造不能靠放松检查换取通过）。
2. 每一项改造都附带一条**证伪实验**：故意破坏 → 门禁必须红。
3. 「手工维护的清单」在仓库里只剩 `scripts/publish-all.mjs` 的 `ORDER`
   （它已有 `assertOrder` 双向校验，且已接进 `verify`）。
