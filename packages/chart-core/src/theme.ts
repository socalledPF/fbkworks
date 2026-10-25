import type { FbkChartTheme } from './types'

/**
 * 主题桥：把 `--fbk-*` CSS 变量读成 ECharts theme 对象。
 *
 * 为什么不把颜色写死在 TS 里：
 *   · 换主题（light / dark / cyber）时图表必须跟着变
 *   · 业务方可能覆盖 --fbk-chart-1 等令牌定制品牌色
 * 写死就意味着两套色值要手动同步，必然漂移。
 *
 * SSR 安全：没有 document 时返回内置默认值，不抛错。
 */

/**
 * 无 DOM 环境下的兜底（与 light 主题一致）。
 *
 * **必须与 tokens.css 的 --fbk-chart-1..8 保持同步。**
 * 这组值只在没有 document 时使用（SSR、单元测试），
 * 但一旦不同步，图表在 SSR 首屏会闪一下旧配色。
 */
const FALLBACK_PALETTE = [
  '#1f3a8a',
  '#4a9d7f',
  '#a87a28',
  '#c2410c',
  '#6a7fb0',
  '#7a5f8f',
  '#3f7d8c',
  '#7d8794',
]

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  return value || fallback
}

function buildEchartsTheme(theme: Omit<FbkChartTheme, '_echartsTheme'>): Record<string, any> {
  return {
    color: theme.palette,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: theme.textColor,
    },
    title: {
      textStyle: { color: theme.textColor, fontWeight: 600 },
      subtextStyle: { color: theme.textSecondary },
    },
    legend: {
      textStyle: { color: theme.textSecondary },
      // 图例图标与文字的间距。默认值在中文标签下偏挤
      itemGap: 16,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: theme.tooltipText, fontSize: theme.fontSize },
      // 与 --fbk-shadow-md 对齐的柔和投影
      extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.12); border-radius: 6px;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: theme.axisLabel },
      // 分割线只在数值轴出现；类目轴用轴线分隔即可，多画一层会乱
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.axisLabel },
      splitLine: { lineStyle: { color: theme.splitLine, type: 'dashed' } },
    },
    line: {
      // 折线默认带一点面积填充，单系列时更易读
      areaStyle: { opacity: theme.areaOpacity },
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
    },
    bar: {
      // 柱状图不加圆角会显得生硬，但圆角过大在密集数据下会失真
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 32,
    },
    pie: {
      itemStyle: { borderWidth: 2, borderColor: theme.bgContainer },
      label: { color: theme.textSecondary },
    },
    gauge: {
      axisLine: { lineStyle: { color: [[1, theme.splitLine]] } },
      axisLabel: { color: theme.textSecondary },
      title: { color: theme.textSecondary },
      detail: { color: theme.textColor },
    },
  }
}

/**
 * 从当前 DOM 读取主题令牌。
 *
 * 读取时机很重要：必须在 `data-fbk-theme` 已切换之后调用，
 * 否则拿到的是上一套主题的值。
 */
export function resolveChartTheme(): FbkChartTheme {
  const base: Omit<FbkChartTheme, '_echartsTheme'> =
    typeof document === 'undefined' || typeof window === 'undefined'
      ? {
          palette: FALLBACK_PALETTE,
          axisLine: '#dee0e3',
          axisLabel: '#646a73',
          splitLine: '#e8eaed',
          tooltipBg: '#ffffff',
          tooltipBorder: '#e8eaed',
          tooltipText: '#1f2329',
          areaOpacity: 0.12,
          textColor: '#1f2329',
          textSecondary: '#646a73',
          bgContainer: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }
      : (() => {
          const styles = getComputedStyle(document.documentElement)
          return {
            palette: Array.from({ length: 8 }, (_, i) =>
              readVar(styles, `--fbk-chart-${i + 1}`, FALLBACK_PALETTE[i]!),
            ),
            axisLine: readVar(styles, '--fbk-chart-axis-line', '#dee0e3'),
            axisLabel: readVar(styles, '--fbk-chart-axis-label', '#646a73'),
            splitLine: readVar(styles, '--fbk-chart-split-line', '#e8eaed'),
            tooltipBg: readVar(styles, '--fbk-chart-tooltip-bg', '#ffffff'),
            tooltipBorder: readVar(styles, '--fbk-chart-tooltip-border', '#e8eaed'),
            tooltipText: readVar(styles, '--fbk-chart-tooltip-text', '#1f2329'),
            areaOpacity: Number(readVar(styles, '--fbk-chart-area-opacity', '0.12')) || 0.12,
            textColor: readVar(styles, '--fbk-color-text', '#1f2329'),
            textSecondary: readVar(styles, '--fbk-color-text-secondary', '#646a73'),
            bgContainer: readVar(styles, '--fbk-color-bg-container', '#ffffff'),
            fontFamily: readVar(styles, '--fbk-font-family', 'system-ui, sans-serif'),
            fontSize: Number(readVar(styles, '--fbk-font-size-md', '14px').replace('px', '')) || 14,
          }
        })()

  return { ...base, _echartsTheme: buildEchartsTheme(base) }
}

/** 取色板中的第 n 个色（循环），供业务侧给系列配色 */
export function chartColor(index: number, theme?: FbkChartTheme): string {
  const palette = (theme ?? resolveChartTheme()).palette
  return palette[index % palette.length]!
}
