import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkPageContainer } from '../src/page-container'

describe('FbkPageContainer', () => {
  it('渲染标题、面包屑与插槽', async () => {
    const wrapper = mountWithAdapter(FbkPageContainer, {
      props: {
        title: '订单详情',
        breadcrumbs: [{ text: '首页', to: '/' }, { text: '订单' }],
      },
      slots: { default: '<div data-test="body">content</div>' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('订单详情')
    expect(wrapper.find('a[href="/"]').text()).toBe('首页')
    expect(wrapper.find('[data-test="body"]').exists()).toBe(true)
  })

  it('点击返回触发 back 事件', async () => {
    const onBack = vi.fn()
    const wrapper = mountWithAdapter(FbkPageContainer, {
      props: { title: 'x', back: onBack },
    })
    await flushPromises()
    await wrapper.find('.fbk-page-container__back').trigger('click')
    expect(onBack).toHaveBeenCalled()
    expect(wrapper.emitted('back')).toBeTruthy()
  })
})
