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

## 注入键为什么用 `Symbol.for`

```ts
export const ADAPTER_CONTEXT = Symbol.for('fbk.adapter.context')
```

pnpm 的严格 node_modules 结构下通常只有一份 `adapter-core`，但微前端、npm link、多版本共存都可能产生两份。
用普通 `Symbol()` 时两份模块的 key 不相等，`inject` 直接失败；`Symbol.for` 走全局注册表，跨模块实例也能命中。

## 契约版本

```ts
export const ADAPTER_API_VERSION = 1
```

`createBusinessKit` 启动时校验 `adapter.meta.apiVersion`。
所有发布包用 Changesets `fixed` 锁步版本，避免 `adapter-core@0.3` 配 `adapter-vant@0.1` 的错配。

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
2. **适配器契约测试**：`@fbk/adapter-conformance` 提供 15 条断言，每个适配器一行接入。
   三个适配器跑同一套断言，保证"换适配器只改注入"这句话是真的。
3. **业务组件测试**：用 mock adapter，只测语义，不测 UI 库 DOM。

```ts
runAdapterConformance({
  adapter: vantAdapter,
  mount: (component, props) => mountWithProvider(component, { adapter: vantAdapter, props }),
  selectors: { row: '.fbk-vant-grid__card', selection: '.fbk-vant-grid__check' },
})
```
