/**
 * 大屏图表的颜色：固定取 cyber 主题的值，**不跟随全局主题**。
 *
 * 之前这三个用 chart-core 的 `var(--fbk-chart-axis-label)` 一类令牌，
 * 而令牌解析的是 documentElement 上当前生效的主题 —— 把大屏放进浅色后台时，
 * 轴标签变成 #646a73 压在 #050910 上（3.66:1，不达 AA），网格线是近黑的刺眼白。
 * 大屏的框架色本来就在 style.css 里硬编码成 cyber，图表跟着它才对得上。
 */
export const SCREEN_AXIS_LABEL = "#94b8c4"
export const SCREEN_SPLIT_LINE = "#142433"
export const SCREEN_AXIS_LINE = "#1b3040"
