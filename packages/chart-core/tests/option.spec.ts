import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FBK_CHART_PALETTE_SIZE,
  CHART_AXIS_LABEL,
  CHART_AXIS_LINE,
  CHART_SPLIT_LINE,
  barRadius,
  seriesColor,
  stackedBarRadius,
} from '../src/option'

/**
 * 共享零件的守卫。
 *
 * 最要紧的一条是 `FBK_CHART_PALETTE_SIZE` 与 tokens 的一致性 ——
 * 这个数字此前在六个图表组件里各内联一次，调色板一改长度就会同时静默失效。
 */

const tokensCssDir = join(import.meta.dirname, '..', '..', 'tokens', 'src', 'css')

describe('FBK_CHART_PALETTE_SIZE 与 tokens 一致', () => {
  it('tokens 里定义的 --fbk-chart-N 个数等于 FBK_CHART_PALETTE_SIZE', () => {
    const defined = new Set<string>()
    for (const file of readdirSync(tokensCssDir).filter((f) => f.endsWith('.css'))) {
      const css = readFileSync(join(tokensCssDir, file), 'utf8')
      for (const match of css.matchAll(/--fbk-chart-(\d+)\s*:/g)) defined.add(match[1]!)
    }

    const indexes = [...defined].map(Number).sort((a, b) => a - b)
    expect(indexes, '--fbk-chart-N 应当从 1 连续编号').toEqual(
      Array.from({ length: FBK_CHART_PALETTE_SIZE }, (_, i) => i + 1),
    )
  })
})

describe('seriesColor', () => {
  it('按调色板长度循环', () => {
    expect(seriesColor(0)).toBe('var(--fbk-chart-1)')
    expect(seriesColor(FBK_CHART_PALETTE_SIZE - 1)).toBe(`var(--fbk-chart-${FBK_CHART_PALETTE_SIZE})`)
    expect(seriesColor(FBK_CHART_PALETTE_SIZE)).toBe('var(--fbk-chart-1)')
  })

  it('显式颜色优先', () => {
    expect(seriesColor(3, '#abcdef')).toBe('#abcdef')
  })

  it('返回的是 CSS 变量字符串，不是解析后的色值', () => {
    // 这一点很关键：改成解析值会改变 option 形态，快照会红
    expect(seriesColor(1)).toMatch(/^var\(--fbk-chart-\d+\)$/)
  })
})

describe('堆叠圆角', () => {
  it('只有最外段有圆角', () => {
    expect(stackedBarRadius(0, 2, false)).toBe(0)
    expect(stackedBarRadius(1, 2, false)).toEqual([4, 4, 0, 0])
  })

  it('横向时圆角方向跟着换', () => {
    expect(stackedBarRadius(1, 2, true)).toEqual([0, 4, 4, 0])
  })

  it('非堆叠时每段都给圆角', () => {
    expect(barRadius(false)).toEqual([4, 4, 0, 0])
    expect(barRadius(true)).toEqual([0, 4, 4, 0])
  })
})

describe('令牌名常量', () => {
  it('与 tokens.css 里的变量名一致', () => {
    const all = readdirSync(tokensCssDir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(tokensCssDir, f), 'utf8'))
      .join('\n')
    for (const token of [CHART_AXIS_LINE, CHART_AXIS_LABEL, CHART_SPLIT_LINE]) {
      const name = token.slice('var('.length, -1)
      expect(all, `${name} 未在 tokens 中定义`).toContain(`${name}:`)
    }
  })
})
