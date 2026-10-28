import { describe, expect, it } from 'vitest'
import { defaultTokens, toCssText, toCssVars } from '../src/index'

/**
 * toCssText()：把令牌序列化成一条 CSS 规则，供运行时以 <style> 注入。
 *
 * 只产出文本、不碰 DOM —— 注入位置与生命周期归 adapter-core 管。
 * 之所以要这条函数：行内变量（element.style.setProperty）会无条件压过
 * dark.css 的 html[data-fbk-theme] 规则，主题就切不动了（checkpoint §6.7）。
 */
describe('toCssText()', () => {
  it('默认产出 :root 规则，逐条覆盖 toCssVars() 的全部变量', () => {
    const css = toCssText()
    expect(css.startsWith(':root{')).toBe(true)
    expect(css.endsWith('}')).toBe(true)
    for (const [name, value] of Object.entries(toCssVars())) {
      expect(css, `缺少变量 ${name}`).toContain(`${name}: ${value};`)
    }
  })

  it('默认参数就是 defaultTokens', () => {
    expect(toCssText(defaultTokens)).toBe(toCssText())
  })

  it('选择器可指定，原样出现在规则最前面', () => {
    expect(toCssText(defaultTokens, '.fbk-scope').startsWith('.fbk-scope{')).toBe(true)
  })

  it('只改一个 spacing 值，其余令牌保持默认', () => {
    const tokens = { ...defaultTokens, spacing: { ...defaultTokens.spacing, md: '99px' } }
    const css = toCssText(tokens)
    expect(css).toContain('--fbk-spacing-md: 99px;')
    expect(css).toContain(`--fbk-spacing-sm: ${defaultTokens.spacing.sm};`)
  })

  it('值里的逗号与引号原样保留（font-family 不能被改写）', () => {
    const family = "Inter, 'PingFang SC', sans-serif"
    const css = toCssText({
      ...defaultTokens,
      font: { ...defaultTokens.font, family },
    })
    expect(css).toContain(`--fbk-font-family: ${family};`)
  })

  it('不产出 camelCase 变量名（浏览器会静默忽略）', () => {
    expect(toCssText()).not.toMatch(/--fbk-[a-z0-9-]*[A-Z]/)
  })
})
