import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbk/test-utils'
import { FbkQueryForm } from '../src/query-form'

const fields = [
  { name: 'keyword', label: '关键词', type: 'input' as const },
  {
    name: 'status',
    label: '状态',
    type: 'select' as const,
    options: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 },
    ],
    defaultValue: 1,
  },
  { name: 'owner', label: '负责人', type: 'input' as const },
  { name: 'remark', label: '备注', type: 'input' as const },
]

describe('FbkQueryForm', () => {
  it('提交时带上默认值与用户输入', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input[data-fbk-part="input"]')
    await inputs[0].setValue('hello')
    await wrapper.findAll('button').find((button) => button.text() === '查询')!.trigger('click')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual(
      expect.objectContaining({ keyword: 'hello', status: 1 }),
    )
  })

  it('折叠时只渲染 visibleCount 个字段', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: true, defaultCollapsed: true, visibleCount: 2 },
    })
    await flushPromises()
    expect(wrapper.findAll('[data-fbk-part="form-item"]')).toHaveLength(2)
  })

  it('重置回到 defaultValues', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false, defaultValues: { keyword: 'x' } },
    })
    await flushPromises()
    const inputs = wrapper.findAll('input[data-fbk-part="input"]')
    await inputs[0].setValue('changed')

    await wrapper.findAll('button').find((button) => button.text() === '重置')!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('reset')?.[0]?.[0]).toEqual(expect.objectContaining({ keyword: 'x' }))
  })

  it('对象形式的 columns 展开成断点变量，而不是静默失效', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false, columns: { xs: 1, md: 3 } },
    })
    await flushPromises()

    const root = wrapper.find('.fbk-query-form').element as HTMLElement
    expect(root.style.getPropertyValue('--fbk-cols-xs')).toBe('1')
    expect(root.style.getPropertyValue('--fbk-cols-md')).toBe('3')
    // 缺省的断点不写变量，交给 CSS 的 var() 回退链
    expect(root.style.getPropertyValue('--fbk-cols-sm')).toBe('')
  })

  it('数字形式的 columns 写 --fbk-cols-base', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false, columns: 2 },
    })
    await flushPromises()

    const root = wrapper.find('.fbk-query-form').element as HTMLElement
    expect(root.style.getPropertyValue('--fbk-cols-base')).toBe('2')
  })

  it('默认让标签等宽，否则控件宽度随标签文字长短变化', async () => {
    // 不传 labelWidth 时，element-plus / naive-ui 会让标签按内容收缩：
    // 「状态」(2 字) 的控件比「负责人」(3 字) 宽 14px。传 'auto' 才是等宽。
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false },
    })
    await flushPromises()

    const form = wrapper.findComponent({ name: 'MockForm' })
    expect(form.props('labelWidth')).toBe('auto')
  })

  it('显式传入的 labelWidth 不被默认值覆盖', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false, labelWidth: 80 },
    })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'MockForm' }).props('labelWidth')).toBe(80)
  })

  it('字段级插槽覆盖默认控件', async () => {
    const wrapper = mountWithAdapter(FbkQueryForm, {
      props: { fields, collapsible: false },
      slots: {
        'field-keyword': '<span data-test="custom">custom-field</span>',
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-test="custom"]').exists()).toBe(true)
  })
})
