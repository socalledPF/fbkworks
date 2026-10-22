import { afterEach, describe, expect, it } from 'vitest'
import { chartColor, resolveChartTheme } from '../src/theme'

/**
 * 主题桥。
 *
 * 核心承诺：图表配色**完全来自 CSS 变量**，不写死 TS 常量。
 * 这样换主题（light / dark / cyber）时图表自动跟随，
 * 业务方覆盖 --fbk-chart-* 也能定制品牌色。
 */

const setVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value)
}

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

describe('resolveChartTheme', () => {
  it('从 CSS 变量读取 8 色色板', () => {
    for (let i = 1; i <= 8; i++) {
      setVar(`--fbk-chart-${i}`, `#00000${i}`)
    }
    const theme = resolveChartTheme()
    expect(theme.palette).toHaveLength(8)
    expect(theme.palette[0]).toBe('#000001')
    expect(theme.palette[7]).toBe('#000008')
  })

  it('变量未定义时回退到内置默认色（不返回空字符串）', () => {
    const theme = resolveChartTheme()
    // 没有任何 CSS 变量时，palette 仍应有 8 个有效值
    expect(theme.palette).toHaveLength(8)
    for (const color of theme.palette) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('读取轴线、标签、分割线等语义色', () => {
    setVar('--fbk-chart-axis-line', '#aaaaaa')
    setVar('--fbk-chart-axis-label', '#bbbbbb')
    setVar('--fbk-chart-split-line', '#cccccc')
    const theme = resolveChartTheme()
    expect(theme.axisLine).toBe('#aaaaaa')
    expect(theme.axisLabel).toBe('#bbbbbb')
    expect(theme.splitLine).toBe('#cccccc')
  })

  it('读取 tooltip 三件套', () => {
    setVar('--fbk-chart-tooltip-bg', '#111111')
    setVar('--fbk-chart-tooltip-border', '#222222')
    setVar('--fbk-chart-tooltip-text', '#333333')
    const theme = resolveChartTheme()
    expect(theme.tooltipBg).toBe('#111111')
    expect(theme.tooltipBorder).toBe('#222222')
    expect(theme.tooltipText).toBe('#333333')
  })

  it('解析 areaOpacity 为数字', () => {
    setVar('--fbk-chart-area-opacity', '0.25')
    expect(resolveChartTheme().areaOpacity).toBe(0.25)
  })

  it('areaOpacity 非法值时回退到 0.12', () => {
    setVar('--fbk-chart-area-opacity', 'not-a-number')
    expect(resolveChartTheme().areaOpacity).toBe(0.12)
  })

  it('解析 fontSize 时去掉 px 单位', () => {
    setVar('--fbk-font-size-md', '16px')
    expect(resolveChartTheme().fontSize).toBe(16)
  })

  it('生成 ECharts theme 对象，色板注入到 color', () => {
    setVar('--fbk-chart-1', '#123456')
    const theme = resolveChartTheme()
    expect(theme._echartsTheme.color[0]).toBe('#123456')
  })

  it('ECharts theme 里类别轴不显示分割线（避免视觉噪音）', () => {
    const theme = resolveChartTheme()
    expect(theme._echartsTheme.categoryAxis.splitLine.show).toBe(false)
  })

  it('ECharts theme 里数值轴显示虚线分割线', () => {
    const theme = resolveChartTheme()
    expect(theme._echartsTheme.valueAxis.splitLine.lineStyle.type).toBe('dashed')
  })

  it('tooltip 背景透明化 ECharts 的默认黑底', () => {
    // ECharts 默认 tooltip 是半透明黑，在亮色主题下很突兀
    const theme = resolveChartTheme()
    expect(theme._echartsTheme.tooltip.backgroundColor).not.toBe('rgba(50,50,50,0.7)')
  })
})

describe('chartColor', () => {
  it('按索引取色', () => {
    for (let i = 1; i <= 8; i++) setVar(`--fbk-chart-${i}`, `#00000${i}`)
    expect(chartColor(0)).toBe('#000001')
    expect(chartColor(3)).toBe('#000004')
  })

  it('超出色板长度时循环', () => {
    for (let i = 1; i <= 8; i++) setVar(`--fbk-chart-${i}`, `#00000${i}`)
    expect(chartColor(8)).toBe('#000001')
    expect(chartColor(11)).toBe('#000004')
  })

  it('接受外部传入的 theme（避免重复读 DOM）', () => {
    setVar('--fbk-chart-1', '#abcdef')
    const theme = resolveChartTheme()
    expect(chartColor(0, theme)).toBe('#abcdef')
  })
})
