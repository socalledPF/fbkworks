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

分项：

| 命令 | 作用 |
|---|---|
| `pnpm lint` | ESLint + 依赖边界规则（UI 库只允许出现在 `packages/adapters/**`） |
| `pnpm lint:deps` | dependency-cruiser 依赖图校验（含循环依赖） |
| `pnpm typecheck` | vue-tsc 全量类型检查 |
| `pnpm test` | Vitest：全部单测，含三个适配器共用的 15 条契约断言 |
| `pnpm build` | turbo 构建全部包 |
| `pnpm check:surface` | 扫描公开 `.d.ts`，禁止泄漏 UI 库类型 |
| `pnpm check:packages` | publint |
| `pnpm check:types` | attw（ESM-only profile） |
| `pnpm check:consumer` | 消费者烟雾测试：按 exports 解析已构建产物 |
| `pnpm check:diagrams` | 校验架构图里的 Mermaid 语法与文件名引用 |
| `pnpm docs:build` | VitePress 构建 |

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

**首次发布 `0.1.0`**（8 个包版本号当前都已是 `0.1.0`，不需要跑 `version-packages`）：

```bash
npm login
pnpm build
pnpm publish:dry        # 先干跑一遍，确认 8 个包都能打包
pnpm publish:all        # 按依赖顺序正式发布
```

`publish:all` 按拓扑序（tokens → shared → adapter-core → adapters/* → components → resolver）逐个发布，
任何一个失败就停止后续——保证 registry 上任意时刻的已发布集合都是可安装的。

> 必须走 `pnpm publish`，不能用 `npm publish`：包之间用 `workspace:^` 协议，
> 只有 pnpm 会在打包时把它改写成真实版本号（`^0.1.0`）。用 npm 发出去的 tarball 里会字面量保留
> `workspace:^`，消费者安装直接失败，而且已发布的版本号不能覆盖，只能发新版本。

**后续版本**：

```bash
pnpm changeset          # 描述本次变更
pnpm version-packages   # 消费 changeset 并更新版本
pnpm release            # changeset publish
```

所有发布包用 Changesets `fixed` 锁步版本，`publishConfig.access` 为 `public`。
