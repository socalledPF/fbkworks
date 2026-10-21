# 设计记录：Playground 与 Demo 的原生元素统一

## 实测结果

扫描 11 个 demo 页面，共 39 个非组件元素，**16 个未接入设计系统**：

| demo | 元素 | 问题 |
|---|---|---|
| `crud-page/basic` | `<button>新建` | 2px 边框 |
| `form-modal/basic` | `<button>新建订单` | 16px 字号、2px 边框 |
| `result/basic` | 7 个状态切换按钮 | 16px 字号、2px 边框 |
| `result/basic` | `<button>返回首页/重试` | 2px 边框 |
| `feedback/basic` | 5 个触发按钮 | 16px 字号、2px 边框 |

全部是浏览器默认外观：`font-size: 16px`、`border-width: 2px`、
系统默认字体与灰底。

### 为什么之前没发现

`check:styles` 只扫描 `.css` 文件，管不到 demo 的 `.vue` 模板里
直接写的 `<button>`。而 demo 是文档站与 Playground 共用的**评审材料**，
它们的样子直接影响「这个组件库看起来专业吗」的判断。

---

## 设计决策

### 决策 1：在 demo 里用原生 button，还是用 fbk 组件？

| 方案 | 评价 |
|---|---|
| 用 `<FbkButton>` | **不采用**。demo 要演示的是"被评测的组件"，按钮只是触发器；用被测组件当触发器会让阅读者分不清哪部分是被演示的组件 |
| 保留原生 `<button>`，用统一样式类 | **采用**。语义清晰：这是"页面脚手架"，不是"组件能力" |

### 决策 2：样式放哪？

不放在各 demo 的 `<style>` 里（会重复 16 次），也不放 Playground
（demo 同时被文档站使用）。

**采用**：`@fbk/demos` 包内新增 `src/demo.css`，由 `registry` 或
demo 入口统一引入。命名前缀 `fbk-demo-*`，避免与组件样式冲突。

### 决策 3：视觉规格

与业务组件控件完全一致：

| 属性 | 值 |
|---|---|
| 字体 | `var(--fbk-font-family)` |
| 字号 | `var(--fbk-font-size-md)` (14px) |
| 高度 | 32px（与 Button md 一致） |
| 内边距 | `0 var(--fbk-spacing-md)` |
| 圆角 | `var(--fbk-radius-md)` (6px) |
| 边框 | `1px solid var(--fbk-color-border)` |
| 背景 | `var(--fbk-color-bg-container)` |
| 文字 | `var(--fbk-color-text)` |
| hover | 边框转 `--fbk-color-border-strong` |
| 焦点环 | `var(--fbk-shadow-focus-ring)` |
| 按钮间距 | `var(--fbk-spacing-sm)` (8px) |

三种变体：

- `.fbk-demo-btn` —— 默认（次要操作）
- `.fbk-demo-btn--primary` —— 主操作（实色主色底 + onPrimary 文字）
- `.fbk-demo-btn--active` —— 当前选中态（用于 result 的状态切换）

### 决策 4：Playground header 还要改什么？

已在上轮统一了 `select` / `toggle` 的字体、字号、高度、圆角。
本轮补充：

- `.playground__brand` 的字号是 `--fbk-font-size-lg`（18px），
  但缺少字重；标题应该用 semibold
- `header` 的 `gap` 是 `--fbk-spacing-md`（12px），而字段组内部是
  `--fbk-spacing-xs`（4px）。层级差只有 8px，视觉上偏挤。
  改为 header gap `--fbk-spacing-lg`（16px）

---

## 验收标准

1. 扫描脚本报告 **0 个**「未接入设计系统」的原生元素
2. 所有 demo 按钮：`font-size` = 14px、`border-width` = 1px、
   `height` = 32px、`border-radius` = 6px
3. `pnpm check:styles` 扩展后能扫描 `.vue` 模板里的原生标签，
   发现未加 `fbk-demo-*` 类的 `<button>` 时报错
4. `pnpm verify` 全绿

---

## 追加发现（实测截图后）

### 发现 1：ProTable 工具栏右对齐，"新建"孤立一行

CrudPage demo 截图显示：批量条占一行，"新建"按钮单独占一行且靠右，
中间留出大片空白。原因是 `.fbk-pro-table__toolbar` 用了
`justify-content: flex-end`。

**业务惯例**：主操作（新建/添加）在**左**，辅助操作（刷新/列设置）在**右**。

**决策**：工具栏改为 `justify-content: flex-start`，并在文档里说明
"需要右对齐的辅助操作请自行包一层 `margin-left: auto`"。

**影响面**：ProTable 的 toolbar 插槽使用者。当前只有 demo 在用，
无破坏性影响。

### 发现 2：feedback demo 的空日志块

没有记录时仍渲染 `<ul class="fbk-demo-output">`，留下一条突兀的灰条。
已改为 `v-if="log.length"`。

---

## 二次确认结果（用户要求复查）

上一轮声称"已统一"，但**没有对比过 header 与 demo 是否彼此一致**。
实测后发现两处细节没对齐：

| 属性 | header | demo | 处理 |
|---|---|---|---|
| `padding` | `0 8px` | `0 12px` | header 改用 `--fbk-spacing-md` |
| `line-height` | `normal` | `14px` | header 显式声明 `1` |

### 更严重的一处：组件样式压过业务方的类

全量对比 19 个 demo 按钮，发现 3 个（批量删除 / 清空 / 批量处理）
字号是 12px、圆角 2px —— 明明加了 `.fbk-demo-btn` 却没生效。

根因：ProTable 为批量条里的裸 button 写了兜底样式

```css
.fbk-pro-table__bulk button { ... }   /* 特异性 0,2,1 */
```

而业务方的类只有 0,1,0，被压掉了。

**这是组件库的设计缺陷，不是 demo 的问题**：兜底样式不该压过
业务方显式指定的类。改为 `button:not([class])` —— 只兜底
「完全没有类名」的按钮，一旦业务方给了类，外观完全由那个类决定。

已在 `desktop-parity.spec.ts` 加断言防复发。

### 固化对比脚本

`scripts/visual/compare-controls.py`：启动 playground 后运行，
全量对比 header 与所有 demo 按钮的 11 项计算样式，
非 0 退出码表示不一致。合法差异（禁用态配色、primary/active 变体）
已在脚本内识别，不会误报。

### 最终结果

19 个 demo 按钮与 header 控件完全一致。

---

## 三次确认：header 的 select 与 demo 控件

用户指出 select 与 demo 仍不一致。实测后确认问题真实存在，
且**不是数值差异，而是视觉上的垂直居中失效**：

| 属性 | select | button | 说明 |
|---|---|---|---|
| `line-height` | 曾设为 30px | 14px | **这是根因** |
| `padding` | `0 24px 0 12px` | `0 12px` | 右侧 12px 给下拉箭头，必要 |
| `backgroundImage` | 自绘箭头 | none | 必要 |
| `appearance` | none | auto | 必要 |

### 根因

我一开始以为 select 是「替换元素、flex 的 align-items 管不到它」，
于是加了 `line-height: 30px` 想用行高撑满。**这个判断是错的**：
`appearance: none` 之后 select 已经是普通块级盒，flex 能正常居中。
`line-height: 30px` 反而把行盒撑得比内容盒还高，导致文字偏上。

删掉这条覆盖后，select 的 line-height 回到继承值 14px，
与 button 一致，flex 居中正常工作。

### 教训

**「看起来不对」时，先量再改，不要凭对浏览器行为的记忆下结论。**
我这次凭印象认定 select 是替换元素，加了一条错误的补救规则，
反而制造了新问题。截图对比 + 计算样式测量才是可靠路径。

### 对比脚本增强

`scripts/visual/compare-controls.py` 现在同时采集 header 的 button 与
select，并把 select 必需的 3 项差异列入白名单，其余任何差异都报错。
