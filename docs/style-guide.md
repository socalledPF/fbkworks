# 组件样式接入规范

> 这份文档的存在原因：FormModal / CrudPage / Result 三个组件发布时，
> 样式文件写了但**从未被引入**，导致 `gap`、`display:flex` 全部失效，
> 弹窗底部两个按钮紧贴在一起。测试全绿、类型全对，肉眼一看就是坏的。
>
> 根因不是"写错了 CSS"，而是**样式接入链路没有约束**：
> 每个组件的 `style.css` 需要被两处登记才生效，漏一处就静默失效。

---

## 一、样式接入的两条链路

组件的 `style.css` 必须同时登记到**两个入口**，缺一个就有一类使用者拿不到样式：

| 入口 | 服务对象 | 漏掉的后果 |
|---|---|---|
| `packages/components/src/styles/index.css` | 走 `@fbk/components/style.css` 全量引入的业务方 | 全量引入时该组件没有样式 |
| `apps/playground/src/styles.ts` | Playground 与文档站 demo | **开发和评审时看不到真实效果** |

第二条是最危险的：Playground 是唯一的可视化验证环境，漏了它就会出现
"测试全绿、肉眼全坏"——正是本次事故。

---

## 二、新增组件时必须做的事（检查清单）

- [ ] 写 `src/<component>/style.css`
- [ ] 在 `src/styles/index.css` 加 `@import '../<component>/style.css';`
- [ ] 在 `apps/playground/src/styles.ts` 加 `import '@fbk/components/<component>/style.css'`
- [ ] 跑 `pnpm check:styles`（新增的自动校验，见下）
- [ ] 在 Playground 里**实际看一眼**，不只看测试

---

## 三、样式设计规范（写 CSS 前先定这些）

### 3.1 间距

一律用令牌，不写字面量：

实际令牌值（来自 `packages/tokens/src/css/tokens.css`，**以代码为准**）：

| 令牌 | 原语 | 值 |
|---|---|---|
| `--fbk-spacing-xs` | `--fbk-space-4` | 4px |
| `--fbk-spacing-sm` | `--fbk-space-8` | 8px |
| `--fbk-spacing-md` | `--fbk-space-12` | 12px |
| `--fbk-spacing-lg` | `--fbk-space-16` | 16px |
| `--fbk-spacing-xl` | `--fbk-space-24` | 24px |

用途约定：

| 场景 | 令牌 |
|---|---|
| 图标与文字之间 | `--fbk-spacing-xs` (4px) |
| 按钮组内部 | `--fbk-spacing-sm` (8px) |
| 表单项之间 | `--fbk-spacing-md` (12px) |
| 区块之间 | `--fbk-spacing-lg` (16px) |
| 页面级留白 | `--fbk-spacing-xl` (24px) |

### 3.2 按钮组

所有操作区（弹窗底部、表单底部、批量操作）统一：

```css
display: flex;
gap: var(--fbk-spacing-sm);
justify-content: flex-end;
```

移动端（`max-width: 639px`）改为铺满：

```css
justify-content: stretch;
/* 子元素 flex: 1 1 0 */
```

### 3.3 布局容器必须显式声明 `display`

**这是本次事故的直接教训。** `<div>` 默认 `display: block`，此时：

- `gap` 完全不生效（`gap` 只对 flex/grid 有效）
- `justify-content` / `align-items` 也全部无效

写了 `gap` 却没有 `display: flex` 是最隐蔽的样式错误：CSS 合法、不报错、
lint 也过，只是没有任何视觉效果。

### 3.4 字号

组件根节点**必须自己声明 `font-size`**，不能继承：

- naive 的 `NConfigProvider` 会在根节点注入 `font-size: 14px`
- element-plus 不注入，沿用 body 的 16px

不声明就会在两个适配器下长出两套字号，行高与内边距全线错位。

### 3.5 视觉一致性

PC 端 element-plus 与 naive-ui 必须看起来一致。这条由
`packages/internal/adapter-conformance/tests/desktop-parity.spec.ts` 守，
新增组件若两者表现不同，需要在那里加断言。

---

## 四、自动化校验

`pnpm check:styles` 会检查：

1. `src/` 下每个含 `style.css` 的组件目录，都出现在 `styles/index.css` 里
2. 同样出现在 `apps/playground/src/styles.ts` 里
3. 所有 `.fbk-*` 选择器块里，若用了 `gap` / `justify-content` / `align-items`，
   同一规则块内必须有 `display: flex` 或 `display: grid`

第 3 条专门防本次的 bug 复发。

## 五、流程要求

> **任何涉及样式的改动，必须先出设计（间距、对齐、断点行为），
> 再写实现。** 不允许"先把 CSS 写上，看起来不对再调"。

具体做法：

1. 在本文档的「设计记录」里写清楚这次要动哪些视觉属性
2. 在 Playground 里手动确认
3. 再提交

### 设计记录

| 日期 | 组件 | 改动 | 验收标准 |
|---|---|---|---|
| 2026-10-21 | FormModal / CrudPage / Result | 补样式接入 + 修 gap 失效 | 弹窗底部按钮间距 8px（实测）；CrudPage 区块间距 16px；Result 垂直居中 |

---

## 六、运行时依赖的三类划分

> **一句话判定**：换一个后端 / 框架 / UI 库，这段代码还成立吗？
>
> - 不成立 → **第一类**，必须由调用方注入
> - 成立，但平台有等价能力 → **第二类**，用平台能力替代
> - 成立，且是组件本身的存在前提 → **第三类**，走 peerDependency

### 第一类：禁止（硬规则拦截）

| 性质 | 包 | 为什么 |
|---|---|---|
| HTTP 客户端 | axios, ky, ofetch, superagent | 传输层是应用决策，库无权锁定 |
| 路由 | vue-router | 库不该假设 SPA 结构 |
| 状态管理 | pinia, vuex | 同上 |
| 全局 i18n | vue-i18n | 库应接受 `locale` 参数而不是读全局实例 |
| 工具库 | dayjs, moment, lodash, ramda, date-fns | 平台有等价能力 |

**替代方案**：

- 请求 → `request` prop 注入纯函数（`TableRequest` 契约）
- 日期 → `Intl.DateTimeFormat`
- 数字/货币 → `Intl.NumberFormat`
- 数组/对象 → 原生 `Array` / `Object` 方法

这条由三道门禁同时拦截：

1. ESLint `no-restricted-imports`（静态 import）
2. ESLint `no-restricted-syntax`（动态 import / 模板字符串拼接 / require）
3. `pnpm check:runtime-deps`（扫**发布产物**的 import 语句）

> 第 3 道是关键。前两道检查源码，总有绕过方式；第三道检查 `dist/*.mjs`，
> 不管源码怎么写，产物里出现的 bare specifier 就是真实依赖。

### 第二类：需评审（不硬拦，但要说明理由）

| 性质 | 优先替代 | 什么情况下才允许引入 |
|---|---|---|
| 日期 | `Intl.DateTimeFormat` | 需要**时区运算 / 相对时间 / 复杂日历**（Intl 做不到） |
| 十进制运算 | `Intl.NumberFormat` | 需要精确十进制（`0.1 + 0.2` 场景）→ `decimal.js` |
| 深克隆 / 深合并 | `structuredClone`、手写 | 已证明是性能瓶颈 |
| 深比较 | 手写、Vue 的 `watch` | 同上 |

**引入第二类的 PR 必须写清楚三件事**：

1. 为什么不替代（具体到 Intl / 原生 API 做不到什么）
2. 体积代价（gzip 后多少 KB）
3. 是否可以做成可选（peerDependency + 独立入口）

**为什么第二类不硬拦**：硬拦会逼着大家写更差的替代实现。
`packages/shared/src/format.ts` 里那 132 行手工日期拼接就是例证 ——
只因为 `Intl` 在 zh-CN 下输出 `2026/09/01` 而历史实现是 `2026-09-01`。
这个代价是真实存在的，不该用规则掩盖。

### 第三类：允许（走 peerDependency）

| 性质 | 例子 | 为什么允许 |
|---|---|---|
| 渲染引擎 | echarts, d3 | 组件的**存在前提**，不是业务逻辑 |
| 纯类型 | `@types/*` | 零运行时 |
| 框架本身 | vue | 唯一例外，任何 Vue 库都需要 |

第三类必须声明为 `peerDependencies`，**不能进 `dependencies`**。
理由：进 `dependencies` 会导致同一个库被打包两份，实例状态分裂
（比如 echarts 的注册表分裂，图表直接渲染不出来 —— 这个坑踩过）。

可选依赖用 `peerDependenciesMeta.optional`：

```json
{
  "peerDependencies": { "echarts": "^6.0.0" },
  "peerDependenciesMeta": { "echarts": { "optional": true } }
}
```

---

## 七、后端接口适配放在哪里

**核心库不做后端适配。**

`@fbk/components` 的 `request` 是纯函数契约：

```ts
type TableRequest<T> = (params: {
  page: number
  pageSize: number
  sort: SortState | null
  params: Record<string, any>
  signal: AbortSignal
}) => Promise<{ list: T[]; total?: number; hasMore?: boolean }>
```

这个契约**与后端规范无关**。如果把 ruoyi 的 `{ code, msg, rows, total }`
映射写进核心库，就意味着核心库要知道：

- ruoyi 的字段名
- `code === 200` 的成功判定
- token 放在哪个 header

一旦换成 Spring 标准分页（`{ content, totalElements }`）就要再加分支 ——
这正是「万能组件」陷阱。

**正确做法**：由业务项目自己写一层转换，通常 10 行以内：

```ts
const ruoyiRequest: TableRequest<Row> = async ({ page, pageSize, params, signal }) => {
  const res = await http.get('/api/order/list', {
    params: { pageNum: page, pageSize, ...params },
    signal,
  })
  return { list: res.data.rows, total: res.data.total }
}
```

如果多个项目重复写同一套转换，**再**考虑抽成独立的可选包
（`@fbk/request-adapters`），且必须满足：

- 不进任何核心包的 `dependencies`
- 传输层仍然注入（`createRuoyiRequest(http, options)`），不内置 axios
- 只做**形状转换**，不做传输

---

## 八、新增依赖的检查清单

提 PR 前逐条确认：

- [ ] 这个依赖属于哪一类？（对照上面三张表）
- [ ] 第一类：不能加，改用注入或平台能力
- [ ] 第二类：PR 描述里写了「为什么不替代 + 体积 + 能否可选」
- [ ] 第三类：声明为 `peerDependencies`，**没有**写进 `dependencies`
- [ ] 可选依赖加了 `peerDependenciesMeta.optional`
- [ ] `pnpm check:runtime-deps` 通过
