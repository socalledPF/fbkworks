import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 大屏饼图布局规则的**文本**断言（设计稿 2026-10-28 §1.3）。
 *
 * 它不验证布局：jsdom 没有布局引擎，offsetHeight / getComputedStyle 拿到的高度
 * 是假的，据此写出来的断言只是假绿。真实判据——画布高度等于 __pie 高度、
 * 中心文案与环心误差 ≤ 2px——必须浏览器实测（设计稿 §1.4）。
 *
 * 这里钉死的是另一种回归：规则被删、被改回直接子选择器、
 * 或 __pie 不再是 flex 容器（子元素的 flex 会重新静默失效）。
 */

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../src/style.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

/** 取一条选择器的声明表；选择器须完全一致，避免 __pie 命中 __pie > .fbk-chart */
function declarations(selector: string) {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (sel.trim() !== selector) continue
    const map = new Map<string, string>()
    for (const decl of body.split(';')) {
      const idx = decl.indexOf(':')
      if (idx === -1) continue
      map.set(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim())
    }
    return map
  }
  throw new Error(`style.css 缺少规则：${selector}`)
}

describe('大屏图表容器规则（文本断言，不验证布局）', () => {
  it('__pie 是 flex 容器', () => {
    const decls = declarations('.fbk-screen-chart__pie')
    expect(decls.get('display')).toBe('flex')
    expect(decls.get('flex-direction')).toBe('column')
  })

  it('__pie 保留 position: relative —— 中心文案是 absolute，依赖它', () => {
    expect(declarations('.fbk-screen-chart__pie').get('position')).toBe('relative')
  })

  it('饼图的 .fbk-chart 有自己的规则，不再回落到固定的 --fbk-chart-height', () => {
    const decls = declarations('.fbk-screen-chart__pie > .fbk-chart')
    expect(decls.get('flex')).toBe('1 1 0')
    expect(decls.get('min-height')).toBe('0')
    expect(decls.get('height')).toBe('auto')
  })

  it('折线 / 柱状图的直接子规则仍在 —— 它们的 .fbk-chart 是 .fbk-screen-chart 的直接子元素', () => {
    expect(declarations('.fbk-screen-chart > .fbk-chart').get('height')).toBe('auto')
  })

  it('中心文案的偏移仍是 ECharts 的百分比，没有魔法数字', () => {
    const decls = declarations('.fbk-screen-chart__center')
    expect(decls.get('top')).toBe('50%')
    expect(decls.get('left')).toBe('36%')
  })
})
