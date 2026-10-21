import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { FbkResult, RESULT_DEFAULTS } from '../src/result'

/**
 * Result 是纯展示组件，不经过适配层。
 * 测试直接 mount，不需要 mock adapter —— 这也验证了「不是所有组件都要适配」。
 */
describe('FbkResult', () => {
  it('数字状态渲染成大号状态码', () => {
    const wrapper = mount(FbkResult, { props: { status: '404' } })
    expect(wrapper.find('.fbk-result__code').text()).toBe('404')
    // 数字状态不渲染 SVG 图标
    expect(wrapper.find('.fbk-result__glyph').exists()).toBe(false)
  })

  it('403 / 500 同样渲染状态码', () => {
    for (const code of ['403', '500'] as const) {
      const wrapper = mount(FbkResult, { props: { status: code } })
      expect(wrapper.find('.fbk-result__code').text()).toBe(code)
    }
  })

  it('语义状态渲染 SVG 图标', () => {
    for (const status of ['success', 'warning', 'error', 'info'] as const) {
      const wrapper = mount(FbkResult, { props: { status } })
      expect(wrapper.find('.fbk-result__glyph').exists(), status).toBe(true)
      expect(wrapper.find('.fbk-result__code').exists(), status).toBe(false)
    }
  })

  it('不传 title 时用该状态的默认文案', () => {
    const wrapper = mount(FbkResult, { props: { status: '404' } })
    expect(wrapper.find('.fbk-result__title').text()).toBe(RESULT_DEFAULTS['404'].title)
  })

  it('不传 subtitle 时用默认说明，且该状态没有默认说明时不渲染', () => {
    const withDefault = mount(FbkResult, { props: { status: '403' } })
    expect(withDefault.find('.fbk-result__subtitle').exists()).toBe(true)

    const withoutDefault = mount(FbkResult, { props: { status: 'success' } })
    expect(withoutDefault.find('.fbk-result__subtitle').exists()).toBe(false)
  })

  it('显式 title / subtitle 覆盖默认值', () => {
    const wrapper = mount(FbkResult, {
      props: { status: '404', title: '自定义标题', subtitle: '自定义说明' },
    })
    expect(wrapper.find('.fbk-result__title').text()).toBe('自定义标题')
    expect(wrapper.find('.fbk-result__subtitle').text()).toBe('自定义说明')
  })

  it('extra 渲染为详情块', () => {
    const wrapper = mount(FbkResult, {
      props: { status: '500', extra: 'Trace ID: abc-123' },
    })
    expect(wrapper.find('.fbk-result__extra').text()).toContain('abc-123')
  })

  it('actions 插槽渲染操作按钮', () => {
    const wrapper = mount(FbkResult, {
      props: { status: '404' },
      slots: { actions: '<button data-test="back">返回首页</button>' },
    })
    expect(wrapper.find('.fbk-result__actions [data-test="back"]').exists()).toBe(true)
  })

  it('icon 插槽覆盖默认图标', () => {
    const wrapper = mount(FbkResult, {
      props: { status: 'error' },
      slots: { icon: '<span data-test="custom-icon">X</span>' },
    })
    expect(wrapper.find('[data-test="custom-icon"]').exists()).toBe(true)
    expect(wrapper.find('.fbk-result__glyph').exists()).toBe(false)
  })

  it('default 插槽渲染在标题下方', () => {
    const wrapper = mount(FbkResult, {
      props: { status: 'info' },
      slots: { default: '<div data-test="body">补充内容</div>' },
    })
    expect(wrapper.find('.fbk-result__content [data-test="body"]').exists()).toBe(true)
  })

  it('语义色跟随状态', () => {
    const danger = mount(FbkResult, { props: { status: '500' } })
    expect(danger.classes()).toContain('fbk-result--danger')

    const warning = mount(FbkResult, { props: { status: '403' } })
    expect(warning.classes()).toContain('fbk-result--warning')

    const success = mount(FbkResult, { props: { status: 'success' } })
    expect(success.classes()).toContain('fbk-result--success')
  })

  it('data-status 便于测试与埋点', () => {
    const wrapper = mount(FbkResult, { props: { status: '403' } })
    expect(wrapper.attributes('data-status')).toBe('403')
  })
})
