import { afterEach, describe, expect, it } from 'vitest'
import { defaultTokens, darkColorOverrides, cyberColorOverrides } from '@fbkworks/tokens'
import { vantTheme } from '../src/theme'

/**
 * 暗色 / cyber 必须换调色板。
 *
 * apply() 把 --van-* 写成 documentElement 的**行内样式**，行内优先级高于 vant 自己的
 * `html.van-theme-dark` 规则 —— 所以这里写浅色值就等于把 vant 的暗色整片盖掉：
 * 页面底色暗了、van-field / van-cell / van-popup 表面还是白的。
 */
afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-fbk-theme')
})

function readVar(name: string) {
  return document.documentElement.style.getPropertyValue(name)
}

describe('vant 主题桥', () => {
  it('light 下写浅色令牌', () => {
    vantTheme.apply('light', defaultTokens)
    expect(readVar('--van-text-color')).toBe(defaultTokens.color.text)
    expect(readVar('--van-background')).toBe(defaultTokens.color.bg)
  })

  it('dark 下合并 darkColorOverrides（否则行内变量压掉 .van-theme-dark）', () => {
    vantTheme.apply('dark', defaultTokens)
    expect(readVar('--van-text-color'), '暗色仍写浅色文字色，表单表面会保持白底').toBe(
      darkColorOverrides.text,
    )
    expect(readVar('--van-background')).toBe(darkColorOverrides.bg)
  })

  it('cyber 用自己的色值（只引 cyber.css 不够，变量是这里写的）', () => {
    vantTheme.apply('cyber', defaultTokens)
    expect(readVar('--van-primary-color')).toBe(cyberColorOverrides.primary)
  })

  it('providerProps 把 cyber 映射成 dark（暗底主题）', () => {
    expect(vantTheme.providerProps?.('cyber', defaultTokens)).toMatchObject({ theme: 'dark' })
    expect(vantTheme.providerProps?.('dark', defaultTokens)).toMatchObject({ theme: 'dark' })
    expect(vantTheme.providerProps?.('light', defaultTokens)).toMatchObject({ theme: 'light' })
  })
})
