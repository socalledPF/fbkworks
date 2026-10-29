import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { FbkProvider } from '@fbkworks/adapter-core'
import { vantAdapter } from '../src'

/**
 * provider 的 size 必须真的改变控件尺寸。
 *
 * vant 4.10 的 ConfigProvider 只有 tag / theme / zIndex / themeVars /
 * themeVarsDark / themeVarsLight / themeVarsScope / iconPrefix —— 没有 size。
 * 它的控件几何全部由 --van-* 变量顶着（vant 自己的默认值：
 * --van-button-default-height: 44px、--van-button-small-height: 32px、
 * --van-button-mini-height: 24px、--van-button-large-height: 50px、
 * --van-cell-vertical-padding: 10px），所以 size 只能经 themeVars 注入，
 * 落在 provider 元素的行内样式上，靠自定义属性继承作用到子树。
 */

const { Button } = vantAdapter.primitives

const mountInProvider = (props: Record<string, any>) =>
  mount(
    defineComponent({
      setup: () => () =>
        h(FbkProvider, { adapter: vantAdapter, ...props }, { default: () => h(Button, null, () => '查询') }),
    }),
  )

function providerStyle(props: Record<string, any>): string {
  const wrapper = mountInProvider(props)
  const provider = wrapper.find('.van-config-provider')
  expect(provider.exists(), 'provider 元素不存在').toBe(true)
  return provider.attributes('style') ?? ''
}

function varOf(style: string, name: string): string | undefined {
  const matched = new RegExp(`${name}:\\s*([^;]+);`).exec(style)
  return matched?.[1].trim()
}

describe('adapter: vant / provider size 生效', () => {
  it('sm 把控件高度压到 vant 默认值之下', () => {
    const style = providerStyle({ size: 'sm' })
    expect(varOf(style, '--van-button-default-height')).toBe('33px')
    expect(varOf(style, '--van-button-small-height')).toBe('24px')
    expect(varOf(style, '--van-cell-vertical-padding')).toBe('7.5px')
  })

  it('lg 把控件高度抬到 vant 默认值之上', () => {
    const style = providerStyle({ size: 'lg' })
    expect(varOf(style, '--van-button-default-height')).toBe('55px')
    expect(varOf(style, '--van-button-small-height')).toBe('40px')
    expect(varOf(style, '--van-cell-vertical-padding')).toBe('12.5px')
  })

  it('md 不注入任何高度变量（vant 默认就是 md，注入即默认值偏移）', () => {
    const style = providerStyle({ size: 'md' })
    expect(varOf(style, '--van-button-default-height')).toBeUndefined()
    expect(varOf(style, '--van-cell-vertical-padding')).toBeUndefined()
  })

  it('不传 size 时与 md 完全一致', () => {
    expect(providerStyle({})).toBe(providerStyle({ size: 'md' }))
  })

  it('调用方自己传的 theme-vars 保留，size 变量盖在它上面', () => {
    const style = providerStyle({ size: 'sm', 'theme-vars': { buttonRadius: '9px' } })
    expect(varOf(style, '--van-button-radius')).toBe('9px')
    expect(varOf(style, '--van-button-default-height')).toBe('33px')
  })

  it('md 下调用方的 theme-vars 原样透传（不与 size 逻辑纠缠）', () => {
    const style = providerStyle({ 'theme-vars': { buttonRadius: '9px' } })
    expect(varOf(style, '--van-button-radius')).toBe('9px')
    expect(varOf(style, '--van-button-default-height')).toBeUndefined()
  })

  it('变量落在包住内容的 provider 元素上，子树能继承', () => {
    const wrapper = mountInProvider({ size: 'sm' })
    const provider = wrapper.find('.van-config-provider')
    expect(provider.element.contains(wrapper.find('.van-button').element)).toBe(true)
  })
})
