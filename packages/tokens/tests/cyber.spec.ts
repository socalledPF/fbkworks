import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cyberColorOverrides } from '../src/index'

/**
 * cyber 主题的令牌完整性 + 对比度校验。
 *
 * 主题最容易出的问题是「看起来酷但读不清」：
 * 深底 + 亮色的组合很容易在某个语义槽位上跌破 AA。
 * 这里把关键的文字/背景组合全部算一遍，而不是靠肉眼。
 */

const cssPath = join(import.meta.dirname, '..', 'src', 'css', 'cyber.css')
const css = readFileSync(cssPath, 'utf8')

/** 从 cyber.css 里取出一个变量的值（只看 :root 那一块） */
function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!match) throw new Error(`cyber.css 缺少 ${name}`)
  return match[1]
}

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('cyber 主题令牌完整性', () => {
  it('声明了 data-fbk-theme="cyber" 选择器', () => {
    expect(css).toContain("[data-fbk-theme='cyber']")
  })

  it('声明了 color-scheme: dark（原生控件跟随暗色）', () => {
    expect(css).toContain('color-scheme: dark')
  })

  const required = [
    '--fbk-color-primary',
    '--fbk-color-primary-hover',
    '--fbk-color-primary-text',
    '--fbk-color-primary-bg',
    '--fbk-color-on-primary',
    '--fbk-color-success',
    '--fbk-color-warning',
    '--fbk-color-danger',
    '--fbk-color-info',
    '--fbk-color-success-text',
    '--fbk-color-warning-text',
    '--fbk-color-danger-text',
    '--fbk-color-info-text',
    '--fbk-color-text',
    '--fbk-color-text-secondary',
    '--fbk-color-bg',
    '--fbk-color-bg-container',
    '--fbk-color-bg-elevated',
    '--fbk-color-border',
    '--fbk-color-focus-ring',
  ]

  for (const name of required) {
    it(`定义了 ${name}`, () => {
      expect(() => token(name)).not.toThrow()
    })
  }
})

describe('cyber 主题对比度（WCAG AA）', () => {
  const bg = token('--fbk-color-bg-container')

  it('正文文字 ≥ 4.5:1', () => {
    expect(contrast(token('--fbk-color-text'), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('次级文字 ≥ 4.5:1', () => {
    expect(contrast(token('--fbk-color-text-secondary'), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('主色作为链接文字 ≥ 4.5:1', () => {
    expect(contrast(token('--fbk-color-primary-text'), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('状态文字色全部 ≥ 4.5:1', () => {
    for (const key of ['success', 'warning', 'danger', 'info'] as const) {
      const ratio = contrast(token(`--fbk-color-${key}-text`), bg)
      expect(ratio, `${key}-text 对比度 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('实色主色底上的文字 ≥ 4.5:1', () => {
    // 这是最容易翻车的一处：青色很亮，白字压上去必然不达标
    const ratio = contrast(token('--fbk-color-on-primary'), token('--fbk-color-primary'))
    expect(ratio, `on-primary 对比度 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('hover 后实色底上的文字仍 ≥ 4.5:1', () => {
    // 底变亮，文字不变，对比度只会升高；但方向搞反就会跌破
    const ratio = contrast(token('--fbk-color-on-primary'), token('--fbk-color-primary-fill-hover'))
    expect(ratio, `fill-hover 对比度 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('焦点环在容器底上 ≥ 3:1（非文本元素标准）', () => {
    expect(contrast(token('--fbk-color-focus-ring'), bg)).toBeGreaterThanOrEqual(3)
  })

  it('浮层底与容器底有可分辨的明度差', () => {
    // 两个面如果几乎同色，卡片边界会消失
    const ratio = contrast(token('--fbk-color-bg-elevated'), bg)
    expect(ratio).toBeGreaterThan(1.05)
  })
})

/**
 * CSS 与 TS 两份色值必须逐字段一致。
 *
 * 为什么有两份：cyber.css 给纯 CSS 消费者，cyberColorOverrides 给适配器
 * 注入 UI 库自己的变量（element-plus 的 --el-color-primary 等）。
 * 只写 CSS 会让主按钮保持蓝色（实测过的割裂），只写 TS 则纯 CSS 消费者
 * 拿不到主题。两份并存就必须有断言防漂移。
 */
describe('cyber：CSS 与 TS 色值一致', () => {
  const kebab = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

  for (const [key, value] of Object.entries(cyberColorOverrides)) {
    if (typeof value !== 'string' || !value.startsWith('#')) continue
    it(`--fbk-color-${kebab(key)} 与 cyberColorOverrides.${key} 一致`, () => {
      expect(token(`--fbk-color-${kebab(key)}`).toLowerCase()).toBe(value.toLowerCase())
    })
  }
})
