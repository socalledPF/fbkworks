import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { resetWarnCache } from '@fbkworks/shared'
import { FbkFormGenerator } from '../src/form-generator'
import { FbkQueryForm } from '../src/query-form'

/**
 * 字段类型必须路由到对应的原语。
 *
 * 此前 date / date-range / radio / time / rate / slider / upload 全部落进
 * default 分支，被渲染成普通文本框 —— 不报错，看起来"支持"，实际不是。
 * 这类静默降级比"不支持"更难排查。
 */
describe('FormGenerator 字段类型路由', () => {
  const mount = (field: Record<string, any>, extra: Record<string, any> = {}) =>
    mountWithAdapter(FbkFormGenerator, {
      props: { schema: { fields: [field] }, ...extra },
    })

  it('date 走 DatePicker，不是文本框', async () => {
    const wrapper = mount({ name: 'd', label: '日期', type: 'date' })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="date-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-fbk-part="input"]').exists()).toBe(false)
    expect(wrapper.find('[data-fbk-part="date-picker"]').attributes('data-picker-type')).toBe('date')
  })

  it('datetime 走 DatePicker 且 type 正确', async () => {
    const wrapper = mount({ name: 'dt', label: '时间', type: 'datetime' })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="date-picker"]').attributes('data-picker-type')).toBe('datetime')
  })

  it('date-range 映射成 daterange', async () => {
    const wrapper = mount({ name: 'range', label: '区间', type: 'date-range' })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="date-picker"]').attributes('data-picker-type')).toBe('daterange')
  })

  it('radio 走 Radio 原语', async () => {
    const wrapper = mount({
      name: 'r',
      label: '单选',
      type: 'radio',
      options: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
      ],
    })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="radio"]').exists()).toBe(true)
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
  })

  it('date 字段的值能双向绑定', async () => {
    const wrapper = mount({ name: 'd', label: '日期', type: 'date' }, { defaultValues: { d: '2026-01-01' } })
    await flushPromises()
    const picker = wrapper.find('[data-fbk-part="date-picker"]')
    expect((picker.element as HTMLInputElement).value).toBe('2026-01-01')

    await picker.setValue('2026-12-31')
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual(expect.objectContaining({ d: '2026-12-31' }))
  })

  it('未实现的类型降级但仍可用，并给出一次性警告', async () => {
    resetWarnCache()
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount({ name: 's', label: '评分', type: 'rate' })
    await flushPromises()

    expect(wrapper.find('[data-fbk-part="input"]').exists()).toBe(true)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('rate'))
    spy.mockRestore()
  })
})

describe('QueryForm 字段类型路由', () => {
  const mount = (fields: Record<string, any>[]) =>
    mountWithAdapter(FbkQueryForm, { props: { fields, collapsible: false } })

  it('date 走 DatePicker', async () => {
    const wrapper = mount([{ name: 'd', label: '日期', type: 'date' }])
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="date-picker"]').exists()).toBe(true)
  })

  it('date-range 走 DatePicker 的区间模式', async () => {
    const wrapper = mount([{ name: 'r', label: '区间', type: 'date-range' }])
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="date-picker"]').attributes('data-picker-type')).toBe('daterange')
  })

  it('radio 走 Radio 原语', async () => {
    const wrapper = mount([
      {
        name: 'st',
        label: '状态',
        type: 'radio',
        options: [
          { label: '启用', value: 1 },
          { label: '禁用', value: 0 },
        ],
      },
    ])
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="radio"]').exists()).toBe(true)
  })
})
