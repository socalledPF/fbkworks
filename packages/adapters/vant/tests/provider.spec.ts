import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { FbkProvider } from '@fbkworks/adapter-core'
import { vantAdapter } from '../src'

/**
 * attrs 落点：调用方在 Provider 上挂的 class / data-* 必须出现在真实 DOM 上。
 *
 * 直接挂载 RootProvider 与经由 <FbkProvider> 两条路径都要成立 ——
 * 后者是业务方的实际用法，前者能定位到底是哪一层吞掉了 attrs。
 */

const Probe = defineComponent({
  name: 'Probe',
  setup() {
    return () => h('div', { 'data-probe': 'content' }, '内容')
  },
})

const PROBE_ATTRS = { class: 'provider-probe', 'data-probe': 'p1' }

function mountNode(render: () => any) {
  return mount(defineComponent({ setup: () => render }))
}

function assertAttrsLanded(wrapper: ReturnType<typeof mountNode>) {
  const root = wrapper.find('.provider-probe')
  expect(root.exists(), 'class 没有落到任何元素上').toBe(true)
  expect(wrapper.find('[data-probe="p1"]').exists(), 'data-* 没有落到任何元素上').toBe(true)
  // 落点必须是包住内容的那个元素
  expect(root.element.contains(wrapper.find('[data-probe="content"]').element)).toBe(true)
}

afterEach(() => vi.restoreAllMocks())

describe('adapter: vant / provider attrs 转发', () => {
  it('RootProvider 上的 class 与 data-* 落在真实 DOM 上', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountNode(() =>
      h(vantAdapter.RootProvider, PROBE_ATTRS, { default: () => h(Probe) }),
    )

    assertAttrsLanded(wrapper)
    expect(
      warn.mock.calls.flat().join(' '),
      'attrs 绑到了 fragment 根上，只 warn 不落 DOM',
    ).not.toContain('Extraneous non-props attributes')
  })

  it('<FbkProvider> 上的 class 与 data-* 落在真实 DOM 上', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountNode(() =>
      h(FbkProvider, { adapter: vantAdapter, ...PROBE_ATTRS }, { default: () => h(Probe) }),
    )

    assertAttrsLanded(wrapper)
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Extraneous non-props attributes')
  })
})
