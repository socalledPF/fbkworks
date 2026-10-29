# 设计稿：大屏饼图布局修正、间距令牌化与断点统一

> 对应审查清单里的四项样式问题（F20 饼图、间距令牌、断点、`check:styles` 门禁）。
> 按项目约定：样式改动先出设计稿，再实现。
>
> 本文只回答三件事：**现状是什么、要改成什么、怎么验证改对了**。
> 所有数字都是实测（命令见文末），不是从旧文档抄的。

---

## 一、F20：大屏饼图高度与中心文案错位

### 1.0 一句话结论

**默认用法（不传 `height`）下，环形图上移、中心文案下坠 55px，底部留白。**
传了 `height="100%"` 时不复现——这正是它长期没被发现的原因（demo 恰好传了）。

### 1.0.1 浏览器实测数据（Chromium，1920×1080，大屏有缩放）

| 场景 | `__pie` 高 | `.fbk-chart` 高 | 中心文案与环心垂直偏移 |
|---|---|---|---|
| **不传 `height`**（默认） | 354px | **245px** | **55px**（未缩放约 63px） |
| 传 `height="100%"` | 354px | 354px | 0 |
| 不传 `height` + 本稿方案 | 354px | **354px** | **0** |

第三行是**先把方案临时应用、重建 screen 后实测**的结果——方案有效性已证，不是纸面推演。

### 1.1 现状（实测）

`ScreenPieChart` 的 DOM 结构有三层，而 CSS 规则只够到两层：

```
.fbk-screen-chart            flex column, gap 8px
└── .fbk-screen-chart__pie   position:relative; flex:1; min-height:0
    │                        ← 注意：这里**不是** flex 容器
    ├── .fbk-chart           ← FbkChart 的根，是 __pie 的子元素
    │   └── .fbk-chart__canvas   position:absolute; inset:0
    └── .fbk-screen-chart__center   position:absolute; top:50%; left:36%
```

现有规则（`packages/screen/src/style.css:399`）：

```css
.fbk-screen-chart > .fbk-chart {   /* 直接子选择器 */
  flex: 1 1 0;
  min-height: 0;
  height: auto;
}
```

**两个断点叠加，导致饼图固定在 280px：**

1. 饼图的 `.fbk-chart` 是 `__pie` 的子元素、`.fbk-screen-chart` 的**孙元素**。
   直接子选择器 `>` 不匹配 → `height:auto` 与 `flex:1` 都没生效。
2. 即使匹配了也没用：`__pie` 是 `position:relative` 但**不是 flex 容器**，
   子元素的 `flex` 属性无处生效。

于是 `.fbk-chart` 回落到 `chart-core/style.css` 的 `height: var(--fbk-chart-height)`（默认 **280px**），
而 `__pie` 被 `flex:1` 撑到面板剩余高度（实测面板 400–500px 时留白 120–220px）。

**中心文案因此错位**：ECharts 的 `center: ['36%','50%']`（`ScreenPieChart.vue:33`）
是相对**画布**算的，而画布只有 280px 高；`.fbk-screen-chart__center` 的 `top:50%`
是相对 `__pie` 算的。两套基准差得越多，中心数字离环心越远。

> 为什么评审没发现：折线图与柱状图的 `.fbk-chart` 是 `.fbk-screen-chart` 的**直接子元素**，
> 规则正常匹配、布局完全正确。**只看折线图必然漏掉这个 bug。**

### 1.2 预期布局

`screen/style.css` 的注释已经写明了意图：

> 图表本体要吃掉剩余空间。`height: auto` 是必须的 —— `.fbk-chart` 默认用
> `height: var(--fbk-chart-height)`，在大屏里那是固定 280px，会把面板撑爆或留白。

所以这是**实现没照做**，不是设计未定。目标布局：

```
面板（flex: 1，高度由大屏栅格分配）
┌─────────────────────────────────┐
│ 标题                             │  ← 14px
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │        环形图（占满）         │ │  ← 画布 = __pie 的整个盒子
│ │           ◯ 62%             │ │  ← 中心文案与环心重合
│ │           已完成             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

环形图**由宽度约束**（ECharts 的 `radius: [innerRadius%, '70%']` 按 min(宽,高)/2 算），
所以面板变高时环不会无限变大，只是垂直居中——这正是大屏需要的稳定观感。

### 1.3 方案

两处改动，缺一不可：

```css
.fbk-screen-chart__pie {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;            /* 新增：让子元素能吃到 flex */
  flex-direction: column;   /* 新增 */
}

/* 新增：饼图的 .fbk-chart 在 __pie 内，需要一条自己的规则 */
.fbk-screen-chart__pie > .fbk-chart {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
}
```

`__center` 是 `position:absolute`，脱离文档流，不受 `__pie` 变 flex 影响。

**不改**：ECharts 的 `center`/`radius`、`__center` 的 `top/left` —— 画布与 `__pie` 同尺寸后，
两组百分比自然对齐，不需要魔法数字。

### 1.3.1 一个必须知道的坑（本轮踩到）

`apps/playground/vite.config.ts` 的 alias **没有覆盖** `@fbkworks/screen` / `@fbkworks/dashboard` /
`@fbkworks/chart-core`——这三个包在 playground 里走 `package.json` 的 `exports`，
即加载 **`dist/` 构建产物**，不是 `src/`。

后果：改 `packages/screen/src/style.css` 在 playground 里**看不到任何变化**，
必须先 `pnpm --filter @fbkworks/screen build`。而 build 脚本是
`vite build && copy-css.mjs && bundle-css.mjs`——
**单独跑 `npx vite build` 会清空 dist 却不生成 `style.css`**，页面直接坏掉。

这与 `style-guide.md` 把 playground 称作「唯一的可视化验证环境」相矛盾，
也是「测试全绿、肉眼全坏」的又一个入口。**建议给这三个包补 alias（单独提出，本稿不含）。**

### 1.4 验收（必须浏览器实测）

jsdom 没有布局引擎，测不出高度。验收必须做两件事，**且第二件是本次 bug 的直接判据**：

1. 面板 400px 高时，`.fbk-chart` 的 `offsetHeight` ≈ `__pie` 的高度（而非 280）。
2. `.fbk-screen-chart__center` 的**几何中心**与 ECharts 画布内的环心重合
   （误差 ≤ 2px）。方法：读取 `__center` 的 `getBoundingClientRect()` 中心，
   与 `.fbk-chart` 矩形的 `(0.36×宽, 0.5×高)` 比较。
3. 回归：折线图 / 柱状图布局不变；`empty` 态与 `loading` 态正常。

---

## 二、间距令牌化

### 2.1 现状

全仓硬编码间距（`gap` / `margin` / `padding` 的字面量 px）：

| 位置 | 数量 | 是否在刻度上 |
|---|---|---|
| `packages/screen/src/style.css` | 16 | **全部在**（2/4/6/8/12/16/24） |
| `packages/dashboard/src/style.css` | 2 | 在 |
| `packages/components/src/*` | 3 | 在 |
| `packages/internal/demos/src/screen/basic.vue` | 9 | 7 在，**2 处 10px 不在** |
| `apps/admin/src/` | 4 | 3 在，**1 处 5px 不在** |
| `apps/playground/src/playground.css` | 2 | 在 |

**关键事实**：原语刻度里已经有 `--fbk-space-2`（2px）与 `--fbk-space-6`（6px）
（`packages/tokens/src/css/primitives.css:101,103`）。所以 2px 与 6px 并非「不在刻度上」，
只是**没有语义别名**。真正不再刻度上的只有两处：`5px` 与 `10px`。

### 2.2 映射规则

| 字面量 | 替换为 | 视觉变化 |
|---|---|---|
| 2px | `var(--fbk-space-2)` | 无（原语直用） |
| 4px | `var(--fbk-spacing-xs)` | 无 |
| 6px | `var(--fbk-space-6)` | 无（原语直用） |
| 8px | `var(--fbk-spacing-sm)` | 无 |
| 12px | `var(--fbk-spacing-md)` | 无 |
| 16px | `var(--fbk-spacing-lg)` | 无 |
| 24px | `var(--fbk-spacing-xl)` | 无 |

**为什么 2px / 6px 用原语而不是新造语义令牌**：`style-guide.md` 给语义令牌定义的用途是
「图标与文字(4) / 按钮组内部(8) / 表单项之间(12) / 区块之间(16) / 页面留白(24)」——
2px 与 6px 不属于其中任何一个。为它们造语义别名等于凭空发明用途；
直接用原语，读的人看数字就知道是几像素。

### 2.3 需要决策的两处（唯一会改变外观的地方）

| 位置 | 现值 | 候选 | 建议 |
|---|---|---|---|
| `apps/admin/src/pages/OrderDetailPage.vue:134` | `margin-top: 5px` | 4px (xs) / 6px | **4px** —— 更接近原值，且是刻度上的下限 |
| `packages/internal/demos/src/screen/basic.vue:221,230` | `gap: 10px` | 8px (sm) / 12px (md) | **12px** —— 该处是统计卡片组的间距，语义上属于「表单项之间/区块内」，取 md |

两处都在**非发布包**（一个 app、一个 demo），影响面仅限本地演示与后台 demo。

---

## 三、断点统一

### 3.1 现状

`style-guide.md:72` 规定移动端是 `max-width: 639px`。实测 src：

| 值 | 文件 |
|---|---|
| **639px**（符合规范） | `descriptions` `form-generator` `form-modal` `query-form` `result` |
| **640px**（偏差） | `detail-page:21` `pro-table:100` `page-container:147`（`@container`） |

后果：视口恰好 640px 时，同一页面里一部分组件处于移动布局、一部分处于桌面布局。

### 3.2 方案

三处 640 → **639**，与规范及其余五个组件一致。

影响窗是 1px（仅视口宽度恰为 640px 时生效），视觉上不可感知；
收益是断点只有一个值，不必记「有时候 639 有时候 640」。

---

## 四、`check:styles` 门禁加固

### 4.1 现状的三个漏洞

1. **`baseSelector` 豁免架空核心检查**（`scripts/check-styles.mjs:170`）：
   `selector.replace(/--[\w-]+/g, '')` 把修饰符全剥掉，任何 `.fbk-x--mod` 只要
   `.fbk-x` 声明过 display 就整块豁免——**恰好豁免了它本该抓的那类失败**
   （修饰类用在没有基类的元素上就是静默失效）。
2. **不扫 `apps/*` 与 `.vue` 的 `<style>` 块**（`:106-110` 只扫 components / adapters / tokens）。
   而四个应用合计 6 个 CSS 文件约 700 行、8 个 `.vue` 带 `<style>`，一行都没检查过。
3. 位于 `@media` 内的规则整条跳过（`:144-153`），实测有真实规则被跳过
   （`form-modal/style.css:120`、`pro-table/style.css:194`）。

### 4.2 方案与顺序

**必须先修 CSS，再收紧门禁**——否则门禁变红指向一堆历史违规，分不清是新引入还是旧账。

1. 先完成第二节的令牌替换与第三节的断点统一。
2. 收紧 `baseSelector`：只在「同一选择器自身」或「其直接后代关系」上豁免，不再剥修饰符。
3. `walkCss` 增加 `apps/*` 与 `.vue` 的 `<style>` 提取。
4. 收紧后跑一次，若有真实违规就修掉，**不许改门禁迁就现状**。

### 4.3 验收

- 收紧后 `node scripts/check-styles.mjs` 退出码 0。
- **证伪**：在某个 `.fbk-x--mod` 块里加 `gap` 而不给基类 → 门禁必须报错。
- **证伪**：在 `apps/admin` 的 CSS 里加一条「有 gap 无 display」→ 门禁必须报错。
- **证伪**：在某个 `.vue` 的 `<style>` 块里加同样违规 → 门禁必须报错。

---

## 五、执行顺序与验收

| 步骤 | 内容 | 验收 |
|---|---|---|
| 1 | 间距令牌替换（除 5px / 10px） | 令牌替换后视觉零变化，`grep` 证明无残留字面量 |
| 2 | 5px → 4px、10px → 12px | 仅这两处有视觉变化，人工确认 |
| 3 | 断点 640 → 639（三处） | `grep` 证明全仓只剩 639 |
| 4 | F20 饼图两处 CSS | **浏览器实测**：画布高度 = `__pie` 高度；中心文案与环心误差 ≤ 2px |
| 5 | 收紧 `check:styles` | 三条证伪实验 |
| 6 | 全量 `pnpm verify` | 绿 |

**第 4 步不能用 jsdom 验收**——它没有布局引擎。这与项目既有约定一致：
「样式类结论必须实测，不能靠读代码」。

---

## 附录：本文数字的复现命令

```bash
# 饼图结构
sed -n '64,92p' packages/screen/src/ScreenPieChart.vue
grep -n -A6 'fbk-screen-chart' packages/screen/src/style.css

# 硬编码间距
grep -rnE '(gap|margin|padding)[a-z-]*:\s*[0-9.]+px' packages/*/src apps/*/src | grep -v 'var(--'

# 原语刻度（证明 2px / 6px 存在）
grep -nE '\-\-fbk-space-[0-9]+:' packages/tokens/src/css/primitives.css

# 断点
grep -rn 'max-width: *63[89]px' packages/*/src apps/*/src --include=*.css --include=*.vue

# 门禁现状
sed -n '104,116p;144,176p' scripts/check-styles.mjs
```
