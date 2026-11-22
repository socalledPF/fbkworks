import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithProvider } from '@fbkworks/test-utils'
import { vantAdapter } from '../src'
import { Select, DatePicker } from '../src'

/** filterable / clearable 以前只声明不读取，这两条锁住「传了就真的生效」。 */

const options = [
  { label: '杭州', value: 'hz' },
  { label: '南京', value: 'nj' },
]

describe('vant Select 的 clearable', () => {
  it('有值时出现清除按钮，点击后把值清空', async () => {
    const wrapper = mountWithProvider(Select, { adapter: vantAdapter,
      props: { modelValue: 'hz', options, clearable: true },
    })
    await flushPromises()

    const clear = wrapper.find('.fbk-vant-select__clear')
    expect(clear.exists(), 'clearable 没有渲染出清除按钮').toBe(true)

    await clear.trigger('click')
    const emitted = (wrapper.findComponent(Select as any) as any).emitted('update:modelValue') ?? []
    expect(emitted.at(-1), '点清除没有把值置空').toEqual([undefined])
    wrapper.unmount()
  })

  it('clearable=false 时不出现', async () => {
    /* 注意要显式传 false：契约里 clearable 缺省是 true（与 element-plus / naive-ui 一致），
       不传并不等于关闭。 */
    const wrapper = mountWithProvider(Select, { adapter: vantAdapter, props: { modelValue: 'hz', options, clearable: false } })
    await flushPromises()
    expect(wrapper.find('.fbk-vant-select__clear').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('vant DatePicker 的 clearable', () => {
  it('有值时出现清除按钮，点击后清空', async () => {
    const wrapper = mountWithProvider(DatePicker, { adapter: vantAdapter,
      props: { modelValue: '2026-01-01', clearable: true },
    })
    await flushPromises()

    const clear = wrapper.find('.fbk-vant-date-picker__clear')
    expect(clear.exists(), 'clearable 没有渲染出清除按钮').toBe(true)

    await clear.trigger('click')
    const emitted = (wrapper.findComponent(DatePicker as any) as any).emitted('update:modelValue') ?? []
    expect(emitted.at(-1)).toEqual([null])
    wrapper.unmount()
  })
})
