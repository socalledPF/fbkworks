import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { FbkProvider } from '@fbk/adapter-core'
import { naiveUiAdapter } from '../src'

/**
 * provider 的 size 必须真的改变控件尺寸。
 *
 * naive-ui 2.45 的 NConfigProvider **没有 size prop**（props 只有 abstract /
 * bordered / clsPrefix / locale / dateLocale / namespace / rtl / tag / hljs /
 * katex / theme / themeOverrides / componentOptions / icons / breakpoints /
 * preflightStyleDisabled / styleMountTarget / inlineThemeDisabled / as），
 * 唯一的中枢是 themeOverrides.common.heightSmall / heightMedium / heightLarge ——
 * 它最终写成每个控件行内的 --n-height，控件自己的 CSS 读的就是这个变量。
 * 所以断言落在控件 DOM 的 --n-height 上，而不是断言我们传进去的对象。
 */

const { Button, Input } = naiveUiAdapter.primitives

/** size 传 undefined 就等于不传：Vue 的 prop 默认值兜底成 md */
const mountInProvider = (size: string | undefined, content: () => any) =>
  mount(
    defineComponent({
      setup: () => () =>
        h(FbkProvider, { adapter: naiveUiAdapter, size } as any, { default: content }),
    }),
  )

function heightVar(selector: string, size: string | undefined, content: () => any): string {
  const wrapper = mountInProvider(size, content)
  const style = wrapper.find(selector).attributes('style') ?? ''
  const matched = /--n-height:\s*([^;]+);/.exec(style)
  expect(matched, `${selector} 上没写出 --n-height：${style}`).not.toBeNull()
  return matched![1].trim()
}

/** 默认档（medium）控件：Input 原语的 size 默认就是 md */
const mediumControlIn = (size: string) => heightVar('.n-input', size, () => h(Input))
/** 小节档（small）控件：验证整条阶梯跟着缩放，而不是只有 medium 一档 */
const smallControlIn = (size: string) => heightVar('.n-button', size, () => h(Button, { size: 'sm' }))

describe('adapter: naive-ui / provider size 生效', () => {
  it('sm / md / lg 渲染出三档不同的默认控件高度', () => {
    expect([mediumControlIn('sm'), mediumControlIn('md'), mediumControlIn('lg')]).toEqual([
      '24px',
      '32px',
      '40px',
    ])
  })

  it('尺寸阶梯整体缩放：size="sm" 的控件也跟着变小/变大', () => {
    expect([smallControlIn('sm'), smallControlIn('md'), smallControlIn('lg')]).toEqual([
      '21px',
      '28px',
      '35px',
    ])
  })

  it('直接用 RootProvider（没有 tokens）时 size 也生效，且不吞掉调用方的 themeOverrides', () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            naiveUiAdapter.RootProvider,
            { size: 'sm', themeOverrides: { common: { borderRadius: '9px' } } },
            { default: () => h(Input) },
          ),
      }),
    )
    const style = wrapper.find('.n-input').attributes('style') ?? ''
    expect(/--n-height:\s*([^;]+);/.exec(style)?.[1].trim()).toBe('24px')
    // 调用方自己的 common 项原样保留，没有被 size 的 heights 整块替换
    expect(/--n-border-radius:\s*([^;]+);/.exec(style)?.[1].trim()).toBe('9px')
  })

  it('不传 size 时与 md 完全一致（默认值零偏移）', () => {
    expect(heightVar('.n-input', undefined, () => h(Input))).toBe('32px')
    expect(heightVar('.n-input', undefined, () => h(Input))).toBe(mediumControlIn('md'))
  })
})
