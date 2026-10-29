# 设计稿：P4-2 详情抽屉

> 状态：**待确认**。本文要先解决一个在动手前必须定下来的分叉，
> 而不是直接给实现方案。

---

## 一、先说结论：这项比「加个抽屉」大

调研后发现两处硬约束，都与最初的设想冲突：

### 1.1 原语层没有抽屉能力

`packages/adapter-core/src/contracts/primitives.ts:114-122`：

```ts
export interface DialogProps {
  modelValue?: boolean
  title?: string
  width?: string | number
  /** 移动端是否使用底部弹出 */
  placement?: 'center' | 'bottom'      // ← 没有 'right'
  closeOnClickModal?: boolean
  showClose?: boolean
}
```

而且实测（对抗性审查 B12）：**element-plus 与 naive-ui 的 Dialog 根本不读 `placement`**
（`grep 'props.placement' packages/adapters/*/src/primitives/Dialog.tsx` → 两家都是 0）。
只有 vant 真正用它切 center/bottom。

所以「用现有 Dialog 加一个 `placement='right'`」这条路，实际是
**先修一个既有缺陷，再加一个新能力**，不是小改动。

### 1.2 把它塞进 `CrudPage` 会违背它自己的设计原则

`packages/components/src/crud-page/types.ts` 的文件头写着：

> 刻意**不做**的事（避免变成项目文档里批判过的「万能组件」）：
> · 不内置弹窗表单 —— 用 `form` 插槽交给业务方
> · 不内置请求库 —— request 仍是调用方注入的函数
> · **不内置增删改 —— 只负责列表这一屏**

「点行打开详情抽屉」属于「增删改」的边缘但明确在「详情查看」范畴。
若做成 `CrudPage` 的内置能力，就得删掉这条原则，或者接受文档与代码再次脱节
——**而「文档与代码脱节」正是本轮审查反复出现的病根**。

---

## 二、需要你选的分叉

### 方案 A：独立 `DetailDrawer` 组件 + 新增 `Drawer` 原语

- 新增原语 `Drawer`（`packages/adapter-core/src/contracts/primitives.ts`）：
  `{ modelValue, title, width, placement: 'right' | 'bottom', closeOnClickModal, showClose }`
- 三个适配器各实现：element-plus → `ElDrawer`、vant → `van-popup position="right"`、
  naive-ui → `NDrawer`
- `@fbk/components` 新增 `FbkDetailDrawer`：内部复用 `DetailPage` 的字段渲染
  （`Descriptions` + `field-*` 插槽），数据走既有 `useDetail`
- 与 `CrudPage` 的关系：**通过 slot 组合**，不改 `CrudPage` 的任何 props

**代价**：契约变更（新原语）+ 三个适配器工作量。
**收益**：与既有设计原则一致；抽屉能力可被业务方独立使用（不只在 CRUD 场景）。

### 方案 B：扩展 `Dialog` 的 `placement` 到 `'right'`

- 契约上只改一个联合类型 + 补文档
- 但必须先修 EP / naive 忽略 `placement` 的缺陷
- `FbkDetailDrawer` 仍作为独立组件（不塞 CrudPage）

**代价**：Dialog 承担两种语义（模态框 / 侧边抽屉），遮罩行为与焦点陷阱不同；
**收益**：契约改动小，适配器不必新增原语。

### 方案 C：只做组件，不改契约

用现有 `Dialog` + CSS 模拟右侧滑出。
**不推荐**：`Dialog` 的 `placement` 在 EP/naive 下就是无效的，CSS 模拟要靠
业务方的 DOM 结构假设，属于本项目一直避免的「脆弱方案」。

---

## 二之一、已定：`Drawer` 为**必填**原语，`ADAPTER_API_VERSION` 升到 3

`packages/adapter-core/src/contracts/adapter.ts` 的版本注释已确立先例：

> 版本 2：新增 DatePicker / Radio 原语与 `feedback` 命令式 API。
> 三者都是**必填**，旧适配器缺少它们会在启动时被 `assertAdapterCompatible` 拦下，
> 因此属于破坏性变更 —— 版本号必须提升。

沿用同一规则：`Drawer` 加入 `UiPrimitives` 与 `required` 清单，版本升到 3。

**为什么不设为可选**：可选意味着 `FbkDetailDrawer` 必须准备一条降级路径
（退回 Dialog？退回普通页？），而每一种降级都是「用户以为能用、实际表现不同」。
项目一贯的判断是**显式失败优于静默降级**（本轮 `vant` 日期类型、空能力位都是这个结论）。
三个第一方适配器都会实现它，所以"必填"的现实成本接近零。

代价要写进变更集：这是一次**破坏性契约变更**，第三方适配器必须补 `Drawer` 并升版。

---

## 三、无论选哪个方案都需要定的四件事

| # | 问题 | 建议 |
|---|---|---|
| 1 | **移动端行为** | 全屏（`placement='bottom'` 撑满）而非右侧 480px —— 手机上没有横向空间 |
| 2 | **宽度** | 桌面默认 `480px`，可配置；不用百分比（详情字段宽度需要确定性） |
| 3 | **「展开为整页」出口** | 提供 `@expand` 事件，由业务方导航 —— 组件不自己决定路由（库不该假设 SPA 结构，见 style-guide §6） |
| 4 | **数据来源** | 复用 `useDetail`（`request: () => Promise<T \| null>`），与 `DetailPage` 同一契约；`null` 渲染 404 态 |

---

## 四、验收标准（实现后）

1. 点击 `ProTable` 行 → 抽屉打开并显示该行详情（用 `rowKey` 取详情）。
2. 抽屉内的字段渲染与 `DetailPage` 完全一致（同一套 `DescriptionItem` 与 `field-*` 插槽）。
3. 移动端（`max-width: 639px`）全屏展示。
4. `request` 返回 `null` → 抽屉内显示 404 态，不是空白。
5. 关闭抽屉不丢失列表的滚动位置与筛选条件。
6. `@expand` 事件可被捕获（用于业务方自行导航）。
7. `CrudPage` 的既有 props 与行为零变化（若采纳方案 A）。

---

## 五、我不建议做的事

- **不建议**把详情抽屉做成 `CrudPage` 的 `detail` prop。理由见 §1.2：
  它与该组件明确写下的「不内置增删改」冲突，且会让 `CrudPage` 的
  `tableProps` / `queryProps` / `selection` 之上再多一层配置，朝「万能组件」走。
- **不建议**在没有移动端方案的情况下先做桌面抽屉。移动端是 vant 适配器的存在理由，
  只做桌面等于再欠一笔债。
