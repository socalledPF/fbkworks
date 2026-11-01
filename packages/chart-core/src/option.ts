/**
 * 图表 option 的共享零件。
 *
 * 只放**没有变体**的东西。轴、grid、legend 的组装**不在这里** ——
 * 六个组件对它们的参数组合各不相同（dashboard 的类目轴没有 axisTick、
 * screen 的 axisLine 多一个 width: 1、饼图根本没有 grid），
 * 硬抽会变成一串开关参数，比重复更难读。判断标准：
 * **抽走的是同一份事实的副本，留下的是有意的差异。**
 *
 * 这里刻意不改变任何产出的值：抽出来的片段与原先内联的逐字段相同，
 * 由 packages/{dashboard,screen}/tests/chart-option.spec.ts 的快照钉住。
 */

/**
 * 调色板长度，必须与 `--fbk-chart-1` … `--fbk-chart-N` 的个数一致。
 *
 * 这不是「魔法数字」而是**跨语言的契约**：TS 这边决定取第几个变量，
 * CSS 那边决定定义了哪几个。此前的写法是在六个组件里各内联一次
 * `(i % 8) + 1` —— 调色板一改长度，六处会同时静默失效
 * （`var(--fbk-chart-9)` 解析不到 → ECharts 收到非法色值 → 静默变黑，不报错）。
 *
 * 与 tokens 的一致性由 option.spec.ts 里的用例守着，不靠记忆。
 */
export const FBK_CHART_PALETTE_SIZE = 8

/** 轴与分隔线用的令牌名。三处重复的字符串收在这里 */
export const CHART_AXIS_LINE = 'var(--fbk-chart-axis-line)'
export const CHART_AXIS_LABEL = 'var(--fbk-chart-axis-label)'
export const CHART_SPLIT_LINE = 'var(--fbk-chart-split-line)'

/**
 * 第 index 个系列的颜色。
 *
 * 返回的是 **CSS 变量字符串**而不是解析后的色值 —— 与原先内联的写法一致，
 * 交给 resolveOptionVars 在 setOption 前统一替换。若改成直接返回解析值，
 * option 的形态就变了（快照会红），收益也不存在。
 */
export function seriesColor(index: number, explicit?: string): string {
  return explicit ?? `var(--fbk-chart-${(index % FBK_CHART_PALETTE_SIZE) + 1})`
}

/**
 * 堆叠柱的圆角。
 *
 * 只有最外段该有圆角 —— 全加会在接缝处出现「双圆角」。
 * 横向时圆角方向要跟着换，否则看起来像贴错边。
 */
export function stackedBarRadius(
  index: number,
  total: number,
  horizontal: boolean,
): number | number[] {
  const outer = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
  if (index !== total - 1) return 0
  return outer
}

/** 非堆叠时每一段都是外段，直接给圆角 */
export function barRadius(horizontal: boolean): number | number[] {
  return horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
}
