# 设计稿：图表 option 下沉到 chart-core（D）

> 目标：**零行为变化**的重构。抽走「同一份事实的副本」，留下「有意的差异」。
> 判断标准沿用项目一贯的那条：抽走的必须是重复，不是差异。

---

## 一、现状实测

| 包 | 组件 | option 段行数 |
|---|---|---|
| `dashboard` | BarChart / TrendChart / PieChart | 53 / 42 / 39 |
| `screen` | ScreenBarChart / ScreenLineChart / ScreenPieChart | 41 / 58 / 36 |

六个文件合计 567 行，其中拼 option 的部分 **269 行**。

重复内容：

| 内容 | 次数 |
|---|---|
| 颜色公式 `var(--fbk-chart-${(i % 8) + 1})` | **6** |
| 轴样式块（`axisLine` / `axisLabel` / `splitLine` 三个令牌） | **4** |
| 堆叠圆角三元表达式 | **2** |

---

## 二、最关键的一条：`chart-core` 已有正确做法，零使用

`packages/chart-core/src/theme.ts:148`：

```ts
/** 取色板中的第 n 个色（循环），供业务侧给系列配色 */
export function chartColor(index: number, theme?: FbkChartTheme): string {
  const palette = (theme ?? resolveChartTheme()).palette
  return palette[index % palette.length]!
}
```

实测：**它只被用过一次** —— `dashboard/src/TrendChart.vue:79` 用 `chartColor` 生成一个
暴露给外部的 `palette`，而那个 `Array.from({ length: 8 })` 也硬编码了 8。

**它从未被用于拼接 option 的系列颜色。** 六个图表组件全部内联
`var(--fbk-chart-${(i % 8) + 1})`，那个 **`8` 是硬编码**。

> 勘误：本稿初版写「`chartColor` 只被它自己的测试调用过，dashboard 与 screen
> 一次都没用」——**这是错的**，是 grep 时漏看了 `.vue` 文件得出的结论。
> 实际使用点见上。这也是本轮第三次「快速 grep 得出的『事实』需要靠读文件纠正」。

token 里恰好定义了 `--fbk-chart-1` … `--fbk-chart-8`，所以现在是对的。但：

> 调色板若改成 6 色或 10 色，六处内联公式会**静默失效** ——
> `var(--fbk-chart-9)` 解析不到 → `resolveOptionVars` 原样返回 →
> ECharts 收到非法色值 → **静默回退成黑色，不报错**。

`chartColor` 用 `palette.length`，会自动适应。

---

## 三、三处已经发生的分歧（需要你确认）

这些**不是重复**，而是两份实现的差异。有些像有意的皮肤，有些像漏改。

### 分歧 1：饼图的 `itemStyle.borderColor`

| 包 | 值 | 视觉后果 |
|---|---|---|
| `dashboard/PieChart` | `var(--fbk-color-bg-container)` | 扇区之间画出「切开的缝」，缝是卡片底色 |
| `screen/ScreenPieChart` | `'transparent'` | 缝是透明，大屏背景网格透出来 |

**我的判断**：两者都可能是有意的——dashboard 的卡片有实底，大屏背景是网格。但**没有注释说明过**，所以无法区分「有意」与「漏改」。

### 分歧 2：饼图的 `avoidLabelOverlap`

`dashboard` 显式写 `true`，`screen` 未设（ECharts 默认也是 `true`）。**行为等价，只是显式与隐式**。

### 分歧 3：面积填充透明度

| 包 | 值 | 来源 |
|---|---|---|
| `dashboard/TrendChart` | `'var(--fbk-chart-area-opacity)'` → **0.12** | 属性令牌 |
| `screen/ScreenLineChart` | `0.18` 字面量 | 硬编码 |

同一件事、两个值、两套机制。**大屏更亮一点可能是有意的**（大屏要更强的视觉冲击），但硬编码意味着它不随令牌变。

---

## 四、落地结果：只抽了「零变体」的三样

原稿设想把轴、grid、legend 一起抽走。实际读下来，六个组件对它们的参数组合**各不相同**：

| 差异 | dashboard | screen |
|---|---|---|
| 类目轴 `axisTick` | bar 有 `{show:false}`，trend **没有**这个键 | 两者都有 |
| `axisLine` | 无 `width` | trend 多一个 `width: 1` |
| `axisLabel` | 无 `fontSize` | 一律 `fontSize: 14` |
| grid `top` | `multi ? 40 : 16` | `multi ? 44 : 20` |
| legend `itemGap` | 16 | 20（且多 `textStyle.fontSize`） |

硬抽会变成一串开关参数（`{ boundaryGap, fontSize, showTick, axisLineWidth, truncate, ... }`），
比重复更难读。**所以只抽真正零变体的三样**：

| 零件 | 消除的重复 |
|---|---|
| `FBK_CHART_PALETTE_SIZE` | 6 处硬编码 `8` + `theme.ts` 里 1 处 |
| `seriesColor(i, explicit?)` | 6 处内联颜色公式 |
| `CHART_AXIS_LINE` / `CHART_AXIS_LABEL` / `CHART_SPLIT_LINE` | 12 处令牌字符串 |
| `stackedBarRadius` / `barRadius` | 2 处堆叠圆角三元 |

轴、grid、legend 的组装**留在各自组件里**——那是配置，不是重复。

### 数字要诚实

option 段总行数只从 **269 → 261**。重复的**体积**本来就小，
风险不在行数而在于：**12 处硬编码字面量**（6 个 `8`、6 个令牌字符串）
分散在六个文件里，改一处调色板就要找全它们。

真正的收益是 `FBK_CHART_PALETTE_SIZE` 被一条测试钉在 tokens 上：
tokens 里 `--fbk-chart-N` 的个数变了，测试立刻红——**不靠记忆，靠门禁**。

## 五、设计原则：小组件，不是大函数

图表 option 天然多样 —— `grid` 对饼图毫无意义。所以**不做**这种设计：

```ts
// ❌ 一定会烂成「万能组件」
buildChartOption({ type, data, categories, stacked, horizontal, innerRadius, ... })
```

`chart-core` 只导出**可组合的零件**：

```ts
// packages/chart-core/src/option.ts
export const axisCategory = (data: string[]) => ({ ... })     // 类目轴 + 三个令牌色
export const axisValue = (opts?: { min?: number }) => ({ ... }) // 数值轴
export const gridOf = (opts?: { tight?: boolean; gap?: number }) => ({ ... })
export const legendOf = (opts: { multi: boolean; gap?: number; fontSize?: number }) => ...
export const seriesColor = (index: number, explicit?: string) => explicit ?? `var(--fbk-chart-${...})`
export const stackedRadius = (index: number, total: number, horizontal: boolean) => ...
export const lineSeriesBase = (opts) => ({ ... })   // symbol / lineStyle 的共享基线
```

每个图表组件仍然自己写 `option`，只是不再重抄这些零件，皮肤差异仍留在各自文件里。

**`seriesColor` 内部改用 `chartColor`**（或至少把 `8` 换成 `palette.length`），消掉那六处硬编码。

---

## 五、安全网：option 快照测试（这是 D 的核心）

jsdom 测不出图表长什么样，所以**重构的正确性只能靠「option 深比较」**。

做法：

1. **先冻结现状**：为每个组件写一组代表性 props，采集当前 `option` 输出，存为 fixture（`__fixtures__/option-*.json`）。
2. **重构**。
3. **断言重构后的 option 与 fixture 深度相等**。

代表性 props 必须覆盖每处分支：

| 组件 | 需要覆盖 |
|---|---|
| BarChart | `series.length > 1`（legend 出现）、`stacked`、`direction: 'horizontal'`（轴互换 + 圆角方向） |
| TrendChart | `series.length > 1`、`smooth`、`area`、`startFromZero` |
| PieChart | `innerRadius = 0` 与 `> 0`（半径数组）、`data` 里的自定义 `color` |
| 三个 Screen 版本 | 同上对应的分支 |

这套 fixture 还有个长期价值：**以后任何人改动图表配置，都会被它拦下并要求显式更新** —— 正是这一轮反复证明缺失的那种守卫。

---

## 六、不做什么

| 不做 | 理由 |
|---|---|
| 统一 dashboard 与 screen 的皮肤数值（字号、柱宽、发光） | 那是设计差异，不是重复 |
| 把 `borderColor` / area opacity 强行统一 | 需你确认是否无意分叉（见第三节） |
| 引入图表配置 DSL 或 schema | 过度设计，且会遮蔽 ECharts 本身 |
| 让 screen 支持 `direction: 'horizontal'` | 那是新功能，不是重构 |
| 改 ECharts 的 `center` 与 CSS 的百分比耦合 | 需要 JS/CSS 同时改，属独立议题 |

---

## 七、验收标准

1. **六个组件的 option 快照全部深度相等**（除第三节里你确认要改的项）。
2. `chart-core` 既有 53 个测试不回归。
3. 六处硬编码 `8` 消失（`grep '(i % 8)'` 为空）。
4. `chartColor` 从「只有测试用」变成「被生产代码使用」。
5. `pnpm verify` 全绿。
6. **证伪**：故意把某个零件的令牌改错一个值 → 快照必须红。

---

## 八、成本

| 项 | 估计 |
|---|---|
| 新增 `chart-core/src/option.ts` | ~80 行 |
| 新增快照 fixture | 6 组件 × 2-4 组 props |
| 改动六个组件 | 只删重复段，不改行为 |
| 风险 | 中等 —— 配置错一个值就变样，且 jsdom 完全测不出视觉 |

风险靠快照兜住。**没有快照就不该动 D。**
