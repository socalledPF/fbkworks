# 视觉改版方案（预览）

三个方向的样式表 + 截图。**当前没有改动仓库里的任何组件代码** —— 这些都是通过
CDP 往运行中的页面注入 `<style>` 截出来的，跑的是真实组件、真实数据。

```text
base.css          三个方向共用：主题桥补齐、表格容器化、文档站/Playground 骨架
a-blueprint.css   方向 A：精密、紧凑、等宽、无阴影
b-console.css     方向 B：分区清晰、中等密度、柔和阴影
c-editorial.css   方向 C：留白、大圆角、无边框
shots/            截图（compare.png 是三个方向并排；dark-docs-* 是暗色主题）
```

复现：

```bash
cat base.css a-blueprint.css > /tmp/a.css     # 换成 b / c 看另外两个方向
```

## 三个方向

| | A · Blueprint | B · Console | C · Editorial |
|---|---|---|---|
| 圆角 | 3 / 5 / 7px | 4 / 8 / 12px | 6 / 10 / 16px |
| 边界 | 1px 实线，无阴影 | 1px 实线 + 极淡阴影 | 无边框，只用阴影 |
| **实测行高** | **39px（一屏 17 行）** | **46px（一屏 15 行）** | **53px（一屏 13 行）** |
| 表头 | 小一号 + 字距 + 二级灰 | 半粗 + 深色 | 小一号 + 下划线 |
| 数字/单号 | 等宽 | 等宽数字 | 等宽数字 |
| 状态标签 | 方角小标签 | 药丸形 | 无底色 + 圆点 |
| 适合 | 开发者工具、高密度后台 | 通用企业后台 | 文档站、对外展示 |

三个方向的**结构改动是一样的**（见下面），区别只在圆角、疏密、边界这三组参数。
也就是说先定方向，再定具体数值，不会返工。

## 评估结果（3 适配器 × 3 方向）

量化验证，不是看着像就行。

| 检查项 | 改造前 | A | B | C |
|---|---|---|---|---|
| 预览区文字对比度（WCAG AA） | 4 项不达标 | 0 | 0 | 0 |
| 三适配器标签对比度 | 2/3 不达标 | 全部达标 | 全部达标 | 全部达标 |
| 表格列被裁 | 是（1334px / 654px） | 否 | 否 | 否 |
| 表头下空白带 | 41px | 无 | 无 | 无 |
| 表格占满容器 | 否（680/1150px） | 是 | 是 | 是 |
| 暗色主题 | 表格变白板 | 正常 | 正常 | 正常 |
| 1280–1439px 与右侧目录重叠 | — | 无 | 无 | 无 |

### 结论

- **B 最稳**：唯一一个第一轮就全部通过的，圆角/密度/对比度都在主流企业后台的
  舒适区，落地风险最低。
- **A 个性最强但最激进**：39px 行高比现状还紧，等宽字用得多，适合开发者工具；
  但密度已经接近下限，再压就该牺牲可读性了。
- **C 最适合文档站**：53px 行高读起来舒服，但作为**后台表格**偏松——一屏少 4 行，
  在真实业务页面里会被用户抱怨。它更适合「对外展示」而不适合「日常操作」。

我的建议：**B 作为组件默认皮肤，C 的留白用在文档站的 demo 区，A 的等宽数字
（单号、金额）可以抽出来单独用在 B 上**。三者不是互斥的，按场景组合收益更大。

### 已知取舍

- A 的 1280px 下表格仍需横向滚动（正文栏只有 612px，放不下 680px 的五列）。
  这是文档版式的物理限制，不是样式没调好；1280 是少数派宽度，接受滚动。
- C 的 53px 行高在 20 行数据时会让 demo 高 1060px，比 B 多 200px。

## 改版要解决的真问题

这几个不是审美偏好，是实测出来的缺陷。

### 1. element-plus 主题桥没补全色阶

`packages/adapters/element-plus/src/theme.ts` 只写了 `--el-color-primary`、
`-light-3`、`-dark-2` 和四个基础状态色。element-plus 的浅色面（标签底、斑马纹、
hover 填充、禁用态）取的是 `light-5/7/8/9` 这一档 —— 没被覆盖，于是这些面
至今仍是 element-plus 自己的调色板。绿是它那支偏黄的绿（`#67c23a` 系），
不是 FBK 的 `#18a058`。**这就是状态标签「说不上哪里不对」的原因：底色和文字来自两套色系。**

`base.css` 里把整条 ramp 补齐，全部引用 FBK 原始色阶。

### 2. VitePress 正文样式穿透进组件内部

`vp-doc.css` 写的是：

```css
.vp-doc table { display: block; border-collapse: collapse; margin: 20px 0; }
.vp-doc th, .vp-doc td { border: 1px solid; padding: 8px 16px; }
.vp-doc tr:nth-child(2n) { background-color: var(--vp-c-bg-soft); }
```

选择器是「任意后代 table」，于是 element-plus 内部那两个 `<table>` 全被命中。
三个可见后果，都实测过：

1. 表头 `<table>` 被加了 20px 上下外边距 → 41px 的表头塞进 81px 的 wrapper，
   表头和数据之间凭空多出一条 **41px 空白带**。
2. `th/td` 被加 1px 全边框 → 文档里的表格多出竖线，Playground 里没有，
   **同一个组件在两个地方长得不一样**。
3. `display:block` 让 `table-layout:fixed` 失效 → 列宽按内容撑开，
   实测列宽合计 1334px 挤进 654px 容器，最后一列被裁掉。

修法是把预览区内的 table 重置回 `display:table` 并清掉 margin/边框，
**不动 padding** —— 行高还要靠 element-plus 自己的 `padding: 8px 0`。

### 3. 表格只占容器一半

五列都写了显式 `width`（160+120+120+100+180 = 680px），在 `table-layout:fixed`
下 element-plus 就按 680px 排。Playground 容器 1150px，**右边 470px 是死的**。

只给 table 设 `width:100%` 不够：`<colgroup>` 里的 `col` 仍写着固定像素，
表格被拉宽但列不跟着长。必须同时放开 `col` 的宽度，让 fixed 布局按比例重分。

### 4. 空工具栏：今天无害，一加样式就变成空白带

`ProTable.vue:159` 是 `v-if="toolbar || $slots.toolbar"`，而 `toolbar` 默认 `true`。
没传 toolbar 插槽时也会渲染一个空的 `.fbk-pro-table__toolbar`。

实测：这个 div 现在确实存在（两个 Vue 注释节点、无文本、高度 **0px**），
所以**当前没有任何可见问题**。但它是这次改版踩到的坑 —— 一旦给工具栏加
`padding` + 底部分隔线（这正是容器化要做的），它就立刻变成一条 20px 的空白带。
第一版方案就是这么翻车的。

样式侧用 `:empty` 可以兜住（注释节点不影响 `:empty`，已实测生效），
但更该在组件里改掉：`toolbar` 为 `true` 只应表示「允许工具栏」，
不该在没有任何内容时也占位。建议改成 `v-if="$slots.toolbar"`。

### 5. 暗色下表格是白板

`.el-table` 在**自己身上**重新声明了底色：

```css
.el-table { --el-table-bg-color: var(--el-fill-color-blank); }
```

这个声明在 `.el-table` 元素上，特异性高于 `:root`，所以只改 `--el-table-bg-color`
传不进去 —— 必须改它真正引用的 `--el-fill-color-blank`。漏掉这一行的后果实测过：
暗色主题下整张表格仍然是一块白板。

另外，`theme.ts` 把变量写在 `document.documentElement` 的**行内样式**上，
行内样式优先级极高，所以「同一变量 element-plus 后加载会盖掉」这件事
在行内样式这里不成立。但文档站里如果没走 FbkProvider（比如直接加 `html.dark`），
就会退化成「class 变了、令牌没变」的假暗色。验证暗色一定要走真实的下拉框。

### 6. 三个适配器渲染同一个状态，对比度差一倍

这条是评审阶段才发现的，比前五条都严重，因为它是**架构层**的问题。

同一个 `valueEnum.status = 'warning'`，三个适配器渲染出的「待支付」：

| 适配器 | 文字 | 底色 | 对比度 | 圆角 |
|---|---|---|---|---|
| element-plus | `#9a6614` | `#fef9f2`（amber-50） | **4.68:1** ✅ | 999px 药丸 |
| vant | `#ffffff` | `#f0a020`（amber-500） | **2.14:1** ❌ | 6px |
| naive-ui | `#f0a020` | 15% 琥珀透明 | **1.79:1** ❌ | 2px |

同一个语义、同一套令牌，两个适配器不合格。原因不是皮肤没调，而是
**适配器把「填充色」当成了「文字色 + 底色」在用** —— 而 `tokens.css` 里
早就把这三者分开了（`-warning` 填充 / `-warning-text` 文字 / `-warning-bg` 浅底）。

这也直接推翻了「能力声明优先于功能对齐」里的一条隐含假设：
能力可以降级，但**可读性不该随适配器变化**。落地时应该把
「状态 → (文字色, 底色)」的映射收进 `adapter-core` 的共享辅助函数，
三个适配器都调它，而不是各自去猜。

### 7. `overflow-x: auto` 会让 vant 的卡片列表一张都渲染不出来

这条是这次改版自己踩出来的，值得记下来。

第一版给 `.fbk-demo__preview` 加了 `overflow-x: auto`（想让宽表格能横向滚），
结果切到 vant 后 ProTable 永远停在「加载中」，**一张卡片都没有**。

原因：`van-list` 靠 `IntersectionObserver` 判断「滚到底了没有」。
`overflow` 非 `visible` 会让预览区变成滚动容器，观察器的参照系随之改变，
`load` 事件不再触发。去掉这一行，40 张卡片立刻正常加载。

横向溢出改用「外层宽度外扩」解决，不靠滚动容器。

## 落地时要改哪里

按架构规则，发布包只能用 `--fbk-*` 与 `.fbk-*`，不能选 UI 库内部类。
所以上面的样式不能直接塞进 `packages/components`，正确的落点：

| 改动 | 落点 |
|---|---|
| 补齐 `--el-color-*-light-N` | `packages/adapters/element-plus/src/theme.ts` |
| 表格容器化、表头样式 | 新增适配器皮肤文件（如 `packages/adapters/element-plus/src/skin.css`） |
| VitePress 穿透修复、demo 版式 | `apps/docs/.vitepress/theme/docs.css` |
| Playground 外壳 | `apps/playground/src/playground.css` |
| 空工具栏 | `packages/components/src/pro-table/ProTable.vue`（组件内） |
| 圆角/疏密/阴影 | `packages/tokens/src/css/primitives.css` 与 `tokens.css` |
| **状态色映射（文字/底色成对）** | `packages/adapter-core` 新增共享辅助，三个适配器共用 |
| **vant / naive-ui 标签对比度** | 各自适配器的主题桥（`--n-*` / `--van-*`），**不能靠 CSS 覆盖** |

最后一条要强调：naive-ui 的标签颜色来自 `NConfigProvider` 的 `themeOverrides`，
最终落成**行内样式**，样式表压不过它。本预览里用 `!important` 只是为了把效果做对，
**真正的修法在 `providerProps`**，不是加 CSS。

`base.css` 里凡是选了 `.el-*` 的规则，落地时都要搬进 element-plus 适配器，
不能留在 `components` 包里 —— 那是 `no-restricted-imports` 与
dependency-cruiser 明确拦住的边界。

---

# 组件层（第三级令牌）

```text
component-tokens.css   组件令牌：--fbk-pro-table-* / --fbk-query-form-* …
component-layer.css    把令牌接到类名上，并补交互态 + 适配器桥接
```

`base.css` 是「把现有页面调好看」，这一层是「让组件本身可配置」。
两者的区别：`base.css` 里的数值是**直接写在选择器里**的，改一个组件要改样式表；
这一层的数值全部经过令牌中转，改密度只换一个 `data-` 属性。

## 为什么需要第三级

仓库的文档写的是三级令牌（primitive → semantic → component），但
`packages/tokens/src/css/` 里只有 `primitives.css` / `tokens.css` / `dark.css`
—— **组件层从来没建过**。组件直接吃语义令牌，于是结构性的数值散落在各处：

- `pro-table/style.css` 里没有行高、表头底色，全靠 UI 库默认值
- `descriptions/style.css` 的列数和字号写死在 `.vue` 的 `:style` 里（`'14px'`、`'2'`）
- `query-form` 回退列数 `3`、`form-generator` 回退 `1`，两个组件对同一个概念给了不同默认

加这一层之后，三个视觉方向（A/B/C）可以收成**三组刻度**。之前三份样式表
真正不同的只有行高、内边距、圆角、表头字重这几项，结构完全一样。

## 三个真实缺陷（这一层查出来的）

### 1. `columns={{ xs, md }}` 从来没生效过

三个组件的类型里都写了 `number | { xs, sm, md, lg }`，但对象形式被静默忽略：

| 组件 | 现状 |
|---|---|
| `QueryForm` | 写入 `--fbk-query-form-responsive`，**没有任何样式消费它** |
| `FormGenerator` | 对象被丢弃，回退成 `1` |
| `Descriptions` | 对象被丢弃，回退成 `2` |

传 `columns={{ xs: 1, md: 3 }}` 今天没有任何效果，也不会报错。

修法不需要 resize 监听：组件把对象拆成 `--fbk-cols-xs/sm/md/lg` 四个变量，
样式表用一条 `var()` 回退链按断点取值。实测：

```
base 3  →  1440px 传 {md:4} 解析为 4  →  500px 传 {xs:2} 解析为 2
```

数字形式（`columns={3}`）由组件写 `--fbk-cols-base`，两种写法共用一条解析路径。

### 2. 表格只占容器 58%（列宽把表体锁死了）

这一条和 `base.css` 里的第 3 条是同一个现象，但根因更具体：

```
表头 wrapper  1166px
表体 <table>   680px   ← 160+120+120+100+180
```

五列都给了显式 `width`，element-plus 把它写成 `<col width="160">`，
表体表格就只有 680px。**表头横跨整个容器，表体缩在左边**，两者列不对齐。

修法：让 `<table>` 铺满容器。但**不要同时把 `<col>` 改成 auto** ——
那样五列会等宽（实测各 234px），「状态」列被撑得和「订单号」一样宽。
保留 `<col>` 的像素值让浏览器按比例拉伸，实测得到 275/206/206/172/309，
列宽的相对关系还是作者定义的。`width` 从「绝对宽度」变成了「宽度权重」。

### 3. 暗色下分页不可读（根因在 theme.ts，不在 CSS）

实测暗色主题下的分页：

| 元素 | 颜色 | 对比度 |
|---|---|---|
| 「共 48 条」/「前往」 | `#646a73` on `#141414` | **3.38:1** ❌ |
| 未选中页码 | `#1f2329` on `#141414` | **1.17:1** ❌ 几乎不可见 |

根因：`packages/adapters/element-plus/src/theme.ts` 把
`tokens.color.textSecondary`（浅色主题的深灰）用
`root.style.setProperty` 写成了**行内变量**。`html.dark` 在样式表里
声明了 `#cfd3dc`，但行内样式优先级更高，暗色永远赢不了。

`@fbk/tokens` 里早就导出了 `darkColorOverrides`，**但没有任何适配器用它**
（只有测试引用了它）。修法：

```ts
const base = mode === 'dark'
  ? { ...tokens, color: { ...tokens.color, ...darkColorOverrides } }
  : tokens
```

`component-layer.css` 里那段分页兜底只能救分页，救不了其它读
`--el-text-color-*` 的组件 —— 它不能替代这个修复。

## 补上的交互态

现有五份 `style.css` 里的 `:hover` / `:focus-visible` / `:disabled` 数量：

| 文件 | 交互态 |
|---|---|
| `pro-table/style.css` | **0** |
| `query-form/style.css` | **0** |
| `form-generator/style.css` | **0** |
| `descriptions/style.css` | **0** |
| `page-container/style.css` | 2（只有面包屑链接） |

后果：可点击的表格行、移动端卡片、操作按钮，鼠标用户有反馈，
键盘用户什么都没有。组件层补上：

- `.el-table__row[tabindex]:focus-visible` — 键盘可聚焦的行必须有焦点环
- `.fbk-vant-grid__card[tabindex]:hover / :focus-visible` — 卡片点击反馈
- 表格行的过渡只保留 `background-color`。element-plus 的 `transition: all`
  会让行高变化也做动画，切密度时整张表会「长大」

## 适配器桥接是这一层的核心价值

组件令牌层是组件和适配器之间**唯一的契约**：

```text
组件写 --fbk-pro-table-row-height
   ↓
适配器翻译成 --el-table-* / --van-* / themeOverrides
```

双方都不写对方的实现细节。没有这一层时，适配器的 `theme.ts` 只能映射通用色板，
表格行高、表头底色、标签尺寸只能吃 UI 库默认值 —— 于是同一个 ProTable
在三个库下面目全非。

### element-plus 的两个坑（都实测过）

1. **`.el-table` 在自己身上重新声明了 `--el-table-*`**。写在 `:root` 上
   特异性不够，永远到不了表格。必须用 `.el-table` 选择器。
2. **行高 / 内边距 / 字号没有 CSS 变量**。它们由
   `.el-table--default .el-table__cell { padding: 8px 0 }` 和
   `.el-table .cell { padding: 0 12px }` 两条固定规则决定，改密度只能覆盖选择器。

### naive-ui 的标签颜色**改不了**

`NTag` 不输出状态 class —— 所有状态的 class 都只是 `n-tag`，
颜色完全靠行内的 `--n-text-color` / `--n-color` 区分。所以
`.n-tag--warning { ... }` 命中不了任何元素。我写的第一版就是这么"修"的，
实测颜色纹丝不动。

尺寸和圆角能用 CSS 覆盖（全局统一），颜色只能走 `themeOverrides`。

### vant 的卡片**不能**裁切

`.fbk-pro-table:not(.fbk-pro-table--cards) { overflow: hidden }` 里的
`:not()` 不是洁癖。`van-list` 用 `IntersectionObserver` 判断触底，
父级一旦 `overflow` 非 `visible` 就变成滚动容器，观察器失效 ——
实测卡片直接渲染 **0 个**。这和 `base.css` 里 `overflow-x` 那个坑是同一个原因。

## 暗色下组件令牌只需覆盖两处

组件令牌大部分是 `var()` 引用语义层，暗色**自动生效**。只有两处要显式覆盖：

1. **主按钮**。浅色是深底白字，暗色必须反过来（primary 在暗色下是浅蓝
   `#5c8bff`，白字压上去只有 3.19:1）。
2. **表头沉底**。暗色下 `bg-sunken(#131317)` 比卡片底 `#18181c` **更暗**，
   表头会像被挖了个洞。改用 `bg-elevated`。

## 验证

```bash
node design-preview/verify.mjs     # 三个适配器 × 明暗 × 响应式列数
```

`cdp.mjs` 是自带的 CDP 驱动（`chrome --headless=new --remote-debugging-port=9222`）。
截图在 `shots/component-{element,naive,vant,dark}.png`。
