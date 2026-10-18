# 为什么需要适配层

企业前端最常见的困境不是"组件不够用"，而是**同一套业务能力要服务三种技术栈**：

- 后台管理用 element-plus；
- 移动端 H5 用 vant4；
- 新业务线选了 naive-ui。

如果直接在业务组件里写三套分支，最终会得到一个 200 个 props 的万能组件，三边都不像；
如果只锁定一个 UI 库，另外两条产品线就无法复用。

FBK 的答案是：**只归一化原语与交互语义，不归一化业务语义**。

| 层 | 职责 |
|---|---|
| `@fbk/tokens` | 设计令牌，只产出 `--fbk-*` CSS 变量 |
| `@fbk/shared` | 无 UI 语义的工具与 composables（受控状态、行 key、格式化） |
| `@fbk/adapter-core` | 契约、注入、能力声明、主题桥、默认单元格渲染 |
| `@fbk/adapter-*` | 把契约落到具体 UI 库，拥有 DOM 与交互 |
| `@fbk/components` | 业务组件：拥有布局与状态，不拥有 DOM 细节 |

依赖方向是单向的：

```text
tokens ← shared ← adapter-core ← adapters
                        ↑
                    components
```

完整的架构图（分层、依赖方向、注入时序、请求竞态、DataGrid 分流、构建链路）见
[架构总览](/guide/architecture-diagrams)。

## 适配层不是"再包一层组件"

很多团队的适配层最后会退化成 `MyButton` 包 `el-button`、`MyInput` 包 `el-input`，结果是多了一层组件却没有任何抽象收益。FBK 的适配器只做三件别处做不到的事：

1. **归一化交互模型**，而不是 props 名称。
   vant 的 `Select` 不是"换个组件名"：它是 `van-field` 只读展示 + `van-popup` + `van-picker` / `van-checkbox-group`。
   业务侧只传 `options` 和 `modelValue`。
2. **归一化命令式 API**。vant 的 `Form` 没有 `validate()`，适配器用 `@submit` / `@failed` 事件桥接成 `Promise<true>`。
3. **归一化表现层**。vant 没有 Table，DataGrid 在移动端渲染成卡片列表，列的取舍由 `column.mobile` 决定，而不是在业务组件里写 `isMobile` 分支。

## 三个必须守住的红线

1. **只有 `packages/adapters/**` 可以 import UI 库，包括 `import type`。**
   这条是整套架构的命门。ESLint 的 `no-restricted-imports` 必须设 `allowTypeImports: false`，dependency-cruiser 再兜一层。
2. **公开 `.d.ts` 里不出现 UI 库类型。**
   `uiProps?: TableProps` 会让 UI 库的小版本升级变成你的 breaking change。所以 `uiProps` 的类型故意是 `Record<string, any>`。
3. **组件库零业务运行时依赖。**
   不内置请求库、不依赖 vue-router、不用 dayjs。请求由调用方通过 `request` 注入，日期格式化用 `Intl`。

## 不是所有组件都要经过适配器

`Descriptions` 只用 tokens + CSS Grid，完全不依赖适配器。
纯展示/布局组件直接吃令牌更稳、更轻——适配层只该承担"三库行为确实不同"的部分。
