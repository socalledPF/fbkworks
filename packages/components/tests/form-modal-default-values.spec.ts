import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkFormModal } from '../src/form-modal'

const schema = {
  fields: [
    { name: 'status', label: '状态', type: 'input' as const },
    { name: 'channel', label: '渠道', type: 'input' as const },
  ],
}

/**
 * 从 apps/admin 订单页迁过来的一条库契约。
 *
 * 「新建订单」弹窗要预填默认状态与渠道，靠的是 FormModal 在 create 模式下
 * 把 **defaultValues** 交给内部 FormGenerator（src/form-modal/FormModal.vue:75-77）：
 *
 *   pendingValues ?? (innerMode === 'edit' ? initialValues : defaultValues)
 *
 * 业务侧把默认值写进 initialValues 时弹窗会空白打开，那正是这条契约被踩坏的形态。
 * 这里显式同时给出两份值，断言落到 FormGenerator 的 modelValue 上 ——
 * 也就是「交给谁」，而不是某个 input 恰好显示了什么。
 */
describe('FormModal create 模式的默认值来源', () => {
  it('create 模式把 defaultValues 交给内部 FormGenerator，而不是 initialValues', async () => {
    const wrapper = mountWithAdapter(FbkFormModal, {
      props: {
        show: true,
        mode: 'create',
        schema,
        initialValues: { status: 'paid', channel: '线上' },
        defaultValues: { status: 'pending', channel: '直营' },
        submit: vi.fn().mockResolvedValue(undefined),
      },
    })
    await flushPromises()

    const form = wrapper.findComponent({ name: 'FbkFormGenerator' })
    expect(form.exists()).toBe(true)
    expect(form.props('modelValue')).toMatchObject({ status: 'pending', channel: '直营' })
  })
})
