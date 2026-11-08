# frontend-business-kit

Vue 3 企业级业务组件库。**一套业务组件，三种 UI 适配器**：element-plus（桌面）、vant4（移动）、naive-ui（桌面）。

业务页面只依赖 `@fbkworks/adapter-core` 的契约，不出现任何 UI 库类型。切换适配器只改应用入口的两行注入代码。

```text
tokens ← shared ← adapter-core ← adapters
                        ↑
                    components
```

## 包

| 包 | 说明 |
|---|---|
| `@fbkworks/tokens` | 设计令牌，产出 `--fbk-*` CSS 变量 |
| `@fbkworks/shared` | 无 UI 语义的工具与 composables |
| `@fbkworks/adapter-core` | 契约、注入、能力声明、主题桥、默认单元格渲染 |
| `@fbkworks/adapter-element-plus` | element-plus 适配器 |
| `@fbkworks/adapter-vant` | vant4 适配器（DataGrid 渲染为卡片列表） |
| `@fbkworks/adapter-naive-ui` | naive-ui 适配器（provider 型主题） |
| `@fbkworks/components` | 业务组件：ProTable / QueryForm / FormGenerator / PageContainer / Descriptions |
| `@fbkworks/resolver` | 可选的 unplugin-vue-components 解析器 |

## 快速开始

```bash
pnpm install
pnpm playground   # http://localhost:5174，运行时切换适配器与主题
pnpm admin        # http://localhost:5185，完整后台管理系统 demo
pnpm docs:dev     # VitePress 文档站
```

业务应用接入：

```ts
import { createBusinessKit } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'

import '@fbkworks/tokens/css'
import '@fbkworks/adapter-element-plus/style.css'
import '@fbkworks/components/style.css'

createApp(App)
  .use(createBusinessKit({ adapter: elementPlusAdapter, theme: 'light' }))
  .mount('#app')
```

## 验证

```bash
pnpm verify        # 一次跑完全部门禁
```

分项（**完整顺序以 `package.json` 的 `verify` 为准，本表只解释每一项在防什么**）：

| 命令 | 作用 |
|---|---|
| `pnpm lint` | ESLint + 依赖边界规则（UI 库只允许出现在 `packages/adapters/**`） |
| `pnpm lint:deps` | dependency-cruiser 依赖图校验（含循环依赖） |
| `pnpm typecheck` | vue-tsc 全量类型检查 |
| `pnpm test` | Vitest：全部单测，含三个适配器共用的**同一套**契约断言（用例清单以 `adapter-conformance` 源码为准） |
| `pnpm build` | turbo 构建全部包 |
| `pnpm check:surface` | 扫描公开 `.d.ts`，禁止泄漏 UI 库类型 |
| `pnpm check:api-snapshot` | 公开**类型**与基线一致（`api-snapshot/`）。改一个 prop 的名字/类型对消费者是破坏性变更，此前没有任何门禁会红 |
| `pnpm check:size` | 每个 `exports` 入口的可达体积与基线一致（`size-baseline.json`）。涨超 5% 且涨超 2 KB 才红 |
| `pnpm check:styles` | 每条组件样式是否被登记 + 布局声明（用了 `gap` 必须有 flex/grid） |
| `pnpm check:style-index` | 两个样式入口的**生成结果**是否与组件目录一致（过期即红） |
| `pnpm check:style-entries` | 各应用是否接了聚合样式入口 |
| `pnpm check:runtime-deps` | 发布包的运行时依赖是否被正确声明 |
| `pnpm check:packages` | publint |
| `pnpm check:types` | attw（ESM-only profile） |
| `pnpm check:consumer` | 消费者烟雾测试：按 exports 解析已构建产物 |
| `pnpm check:resolver-map` | resolver 映射是否与 `components` 的导出一致 |
| `pnpm check:capabilities` | 每个能力位都要交代验证责任，且「未验证」必须为 0 |
| `pnpm check:publish-order` | 发布清单与拓扑序（新增发布包却忘了登记会在这里红） |
| `pnpm check:diagrams` | 校验架构图里的 Mermaid 语法与文件名引用 |
| `pnpm docs:build` | VitePress 构建 |

另有七个**不在 `verify` 里**的命令：

| 命令 | 何时用 |
|---|---|
| `pnpm gen:style-index` | 新增/删除组件后，重新生成两个样式入口 |
| `pnpm gen:resolver-map` | 新增/删除组件后，重新生成 resolver 映射 |
| `pnpm gen:chart-fixtures` | 有意调整图表配置后重新冻结 option 基线（**改动应可解释**） |
| `pnpm gen:api-snapshot` | 有意改公开 API 后重写类型基线——**把 diff 一起提交**，那正是不兼容变更的清单 |
| `pnpm size` | 打印每个入口的体积表（JS/CSS 的 raw 与 gzip）。不写文件 |
| `pnpm gen:size-baseline` | 有意改变体积后重写基线——**把 diff 一起提交**，那就是这次变胖/变瘦的账 |
| `pnpm verify:fresh` | 在**全新克隆**里跑一遍完整 CI（实测 171–243s）。三次 CI 事故都是「本地通、全新克隆挂」，这是唯一能根治的手段 |

### 视觉回归（真实浏览器，跑在 CI 里）

jsdom 没有布局引擎，也没有 CSS 特异性——**布局、绘制、主题跟随这三类问题只能在真实浏览器里验**。
`ci.yml` 的 `visual` job 会起 dev server 跑下面四个脚本；本地复现时先按「需要先起」那一列起服务：

| 脚本 | 需要先起 | 为什么单测覆盖不到 |
|---|---|---|
| `verify-charts.py` | `pnpm playground` | ECharts 画不出像素；等比缩放的 transform 只有真实布局算得出来 |
| `verify-playground.py` | `pnpm playground` | 侧边栏 / 搜索 / 深链是页面级组合 |
| `verify-form-capabilities.py` | `pnpm playground` | `labelWidth` 要量真实宽度；`validateOn` 在 jsdom 里恒返回 true |
| `compare-controls.py` | `pnpm playground` | 组件样式以更高特异性压掉业务方的类（`.fbk-pro-table__bulk button` 干过一次），只在「用了那个组件的那一页」露头 |
| `verify-admin.py` | `pnpm admin` | 工具条与批量条的层级、权限是删 DOM 而非 `display:none`、上报事件真的可达 |

`compare-controls.py` 曾经不在 CI 里：它原本还比较「playground header 的原生控件 vs demo 按钮」，
而 header 改版后那半边的前提就不存在了。现在已窄化成只做**跨 demo 的 `.fbk-demo-btn` 形状一致性**，
比字体/行高/高度/内边距/圆角/边框/原生外观，不比颜色（变体本来就该不同），并已实测能失败：
在某一个 demo 里注入 `.fbk-demo-btn { height: 40px }`，它会精确报出那一页的两个按钮 32px → 40px。

## 文档同步

**改代码时，对应的文档要同一次提交里改掉。** 这一轮审查里，光是「文档写的和代码做的不一致」就抓到四处
（契约断言条数 15 vs 实际 24、样式清单还在教人手工改已生成的文件、primitive 清单少列 4 个、旧仓库链接）。

对照表：

| 你改了什么 | 必须同步更新 |
|---|---|
| 新增 / 删除原语 | `apps/docs/guide/architecture.md`（原语与可选层）<br>`apps/docs/adapters/custom.md`（`UiPrimitives` 列表）<br>`packages/adapter-core/README.md`<br>`apps/docs/guide/architecture-diagrams.md`（类图） |
| 变更「什么情况该升契约版本」 | `apps/docs/guide/architecture.md` 的「什么时候该升版本号」<br>`packages/adapter-core/src/contracts/adapter.ts` 顶部注释 |
| 新增 / 删除能力位 | `packages/internal/adapter-conformance/src/capability-coverage.ts`（必须交代验证责任，否则测试红） |
| 有意修改公开 API（prop / 类型 / 导出） | `api-snapshot/*.json`（跑 `pnpm gen:api-snapshot`，把 diff 一起提交） |
| 有意改变体积（新增依赖 / 大功能） | `size-baseline.json`（跑 `pnpm gen:size-baseline`，把 diff 一起提交） |
| 新增组件 | `docs/style-guide.md` §二 检查清单<br>`packages/components/package.json` 的 `exports` + `vite.config.ts` entry（**仍是手写**） |
| 新增发布包 | `scripts/publish-all.mjs` 的 `ORDER`（`check:publish-order` 会校验） |
| 做了有取舍的架构决定 | `docs/design/` 新增一份设计稿，并在 `architecture.md` 的「设计决策记录」加一行 |

> 原则：**能生成的不要手写，必须手写的要有门禁校验。**
> 上面 `exports` / `vite.config.ts` entry / `ORDER` 三处仍是手写，是目前已知的漏点。

## 目录

```text
apps/
  docs/                  VitePress 文档站（demo 来自 @fbkworks/demos）
  playground/            三适配器调试台
  admin/                 后台管理系统 demo（吃自己的狗粮测试）
packages/
  tokens/ shared/ adapter-core/ components/ resolver/
  adapters/{element-plus,vant,naive-ui}/
  internal/{adapter-conformance,test-utils,build-config,demos}/
scripts/                 copy-css / bundle-css / check-type-surface / check-package-types
tests/consumer/          消费者烟雾测试（按 exports 解析 dist，不走 paths）
```

## 设计要点

- **只有 `packages/adapters/**` 可以 import UI 库，包括 `import type`。** 这是整套架构的命门，ESLint 与 dependency-cruiser 双重拦截。
- **`uiProps` 的类型是 `Record<string, any>`。** 公开 API 里出现 `TableProps` 会让 UI 库小版本升级变成 breaking change。
- **能力声明优先于功能对齐。** 适配器声明 `capabilities`，业务组件按能力降级，不追求三库像素一致。
- **vant 没有 Table。** DataGrid 是表现层无关的列描述，移动端渲染成卡片，列取舍由 `column.mobile` 决定。
- **注入键用 `Symbol.for`。** 多份 `adapter-core` 副本时 `provide/inject` 仍然命中。
- **ESM-only + `preserveModules` + 样式独立文件。** 禁止 SFC `<style>`，保证按需样式可控、tree-shaking 有效。
- **零业务运行时依赖。** 不内置请求库、不依赖 vue-router / dayjs。
- **令牌分三层：原始 → 语义 → 主题。** 组件只准用语义层；换主题只改语义层。实色底与描边/文字底的 hover 方向相反，见下面「已知偏差」。

## 已知偏差

这几条是**有意保留**的问题，不是漏改。改它们属于视觉改版或需要动 UI 库内部，不应该夹在重构里顺手做掉。

1. **暗色状态色借的是 naive-ui 调色板**（`#63e2b7` / `#f2c97d` / `#e88080` / `#70c0e8`），不是从本品牌色阶推出来的。保留原值是为了零视觉回归。要清理时应当把 `dark.css` 里这几个值换成蓝/绿/琥珀/红/青色阶的对应步，并同步跑一遍对比度审计。

2. **`--fbk-color-primary-hover` 比主色浅**（`#5c8bff` vs `#2f6bff`），语义上是「hover 提亮」，映射到 element-plus 的 `--el-color-primary-light-3`。但 element-plus 的实色主按钮 hover 底色正是 `light-3`，白字压上去只有 **3.19:1**，低于 WCAG AA 的 4.5:1。这是改造前就存在的行为，动它会改变三个适配器里所有主按钮的观感。FBK 自己的实色元素已改用 `--fbk-color-primary-fill-hover`（变深，6.61:1）绕开这个问题。

3. **element-plus 与 naive-ui 的表格行无法键盘聚焦。** 行的 DOM 由这两个库渲染，加不上 `tabindex`。vant 的卡片列表是 FBK 自己渲染的，已经补上键盘可达性（`tabindex` + Enter/Space + 焦点环，见 `packages/adapters/vant/tests/conformance.spec.ts`）。桌面端表格的行点击目前只对鼠标开放。

4. **浏览器会额外请求 `/favicon.ico` 并拿到 404。** 文档站只提供 `favicon.svg` 并在 `<head>` 里声明。所有现代浏览器都优先用声明的那个，这个 404 是无害的固定行为，不需要补 `.ico`。

## 发布

发布到公开 npm，scope 为 `@fbkworks`（需要在 npm 上创建同名组织并拥有发布权限）。

**正常路径是全自动的**，不需要在本地跑任何发布命令：

```
push / 合并到 main
  → CI（20 步门禁）全绿
  → Release workflow 由 CI 的 completed 事件触发
  → changesets/action：
      · 有待发 changeset → 开/更新 "chore: version packages" PR（此时不发包）
      · 没有待发 changeset、但有未发布的版本号 → pnpm release 发布
```

发布**必须等 CI 全绿**：Release 只在 CI 成功、触发事件是 push、且分支是 main 时才执行，
并显式 checkout 那次 CI 的 `head_sha`。（2026-11-08 之前两者是并行的，实测出现过
「0.4.0 已上 npm，CI 五分钟后才给结论」——见检查点 §四。）

所以日常只有一件事要做：**改代码时带上 changeset**。

```bash
pnpm changeset          # 描述本次变更（决定 minor / patch）
```

之后合并版本 PR、等 CI 绿就行。

### 应急：本地手动发布

CI 长期不可用时，`publish:all` 仍然保留：

```bash
npm login
pnpm build
pnpm publish:dry        # 先干跑一遍，确认 12 个包都能打包
pnpm publish:all        # 按依赖顺序正式发布
```

按拓扑序（tokens → shared → data → adapter-core → chart-core → adapters/* → components →
dashboard → screen → resolver）逐个发布，任何一个失败就停止后续——保证 registry 上任意时刻的
已发布集合都是可安装的。

> 必须走 `pnpm publish`，不能用 `npm publish`：包之间用 `workspace:^` 协议，
> 只有 pnpm 会在打包时把它改写成真实版本号。用 npm 发出去的 tarball 里会字面量保留
> `workspace:^`，消费者安装直接失败，而且已发布的版本号不能覆盖，只能发新版本。

所有发布包用 Changesets `fixed` 锁步版本，`publishConfig.access` 为 `public`。
