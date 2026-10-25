import { afterEach, describe, expect, it } from 'vitest'
import { isCssVar, resolveCssValue, resolveOptionVars } from '../src/color'

/**
 * CSS 变量解析。
 *
 * 为什么这块必须有测试：ECharts 用 Canvas 绘制，**不认 `var(--x)`**。
 * 业务侧写 `color: 'var(--fbk-chart-1)'` 时，如果解析没生效，
 * 会抛 `addColorStop: could not be parsed as a color`，图表看起来"没上色"，
 * 而且这个错误发生在 Canvas 内部，控制台只有一行警告，极难定位。
 */

const setVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value)
}

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

describe('isCssVar', () => {
  it('识别 var(--x) 形式', () => {
    expect(isCssVar('var(--fbk-chart-1)')).toBe(true)
    expect(isCssVar('var(--fbk-color-text)')).toBe(true)
  })

  it('识别带 fallback 的形式', () => {
    expect(isCssVar('var(--x, #fff)')).toBe(true)
  })

  it('识别带空格的形式', () => {
    expect(isCssVar('var( --x )')).toBe(true)
  })

  it('不误判普通色值', () => {
    expect(isCssVar('#fff')).toBe(false)
    expect(isCssVar('rgba(0,0,0,.5)')).toBe(false)
    expect(isCssVar('transparent')).toBe(false)
    expect(isCssVar(undefined)).toBe(false)
    expect(isCssVar(123)).toBe(false)
  })

  it('不误判非完整 var 表达式', () => {
    expect(isCssVar('var(--x) solid')).toBe(false)
    expect(isCssVar('calc(var(--x) * 2)')).toBe(false)
  })
})

describe('resolveCssValue', () => {
  it('把已定义的变量解析成真实值', () => {
    setVar('--fbk-chart-1', '#1f3a8a')
    expect(resolveCssValue('var(--fbk-chart-1)')).toBe('#1f3a8a')
  })

  it('变量未定义时用 fallback', () => {
    expect(resolveCssValue('var(--not-defined, #abcdef)')).toBe('#abcdef')
  })

  it('非变量值原样返回', () => {
    expect(resolveCssValue('#fff')).toBe('#fff')
    expect(resolveCssValue('rgba(0,0,0,.1)')).toBe('rgba(0,0,0,.1)')
  })

  it('变量与 fallback 都没有时返回原表达式（不抛错）', () => {
    expect(resolveCssValue('var(--not-defined)')).toBe('var(--not-defined)')
  })
})

describe('resolveOptionVars', () => {
  it('解析对象里的字符串变量', () => {
    setVar('--fbk-chart-1', '#1f3a8a')
    const option = { color: 'var(--fbk-chart-1)', title: { text: '标题' } }
    expect(resolveOptionVars(option).color).toBe('#1f3a8a')
  })

  it('深度遍历嵌套对象', () => {
    setVar('--fbk-chart-2', '#18a058')
    const option = {
      series: [{ itemStyle: { color: 'var(--fbk-chart-2)' } }],
    }
    expect(resolveOptionVars(option).series[0].itemStyle.color).toBe('#18a058')
  })

  it('处理数组', () => {
    setVar('--fbk-chart-3', '#bd7a18')
    const input = ['var(--fbk-chart-3)', '#fff']
    expect(resolveOptionVars(input)).toEqual(['#bd7a18', '#fff'])
  })

  it('处理渐变里的 colorStops（大屏面积图用到）', () => {
    setVar('--fbk-chart-1', '#22d3ee')
    const option = {
      areaStyle: {
        color: {
          type: 'linear',
          colorStops: [
            { offset: 0, color: 'var(--fbk-chart-1)' },
            { offset: 1, color: 'transparent' },
          ],
        },
      },
    }
    const out = resolveOptionVars(option)
    expect(out.areaStyle.color.colorStops[0].color).toBe('#22d3ee')
    expect(out.areaStyle.color.colorStops[1].color).toBe('transparent')
  })

  it('保留非字符串值不变', () => {
    const input = { a: 1, b: true, c: null, d: undefined }
    expect(resolveOptionVars(input)).toEqual(input)
  })

  it('不修改原对象（避免污染业务侧数据）', () => {
    setVar('--fbk-chart-1', '#1f3a8a')
    const original = { color: 'var(--fbk-chart-1)' }
    resolveOptionVars(original)
    expect(original.color).toBe('var(--fbk-chart-1)')
  })

  it('混合结构（数组套对象套数组）', () => {
    setVar('--fbk-chart-4', '#d03050')
    const input = { series: [{ data: [1, 2], lineStyle: { color: 'var(--fbk-chart-4)' } }] }
    expect(resolveOptionVars(input).series[0].lineStyle.color).toBe('#d03050')
  })
})
