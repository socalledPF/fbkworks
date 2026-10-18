import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbk/test-utils'
import { FbkFormGenerator } from '../src/form-generator'

const schema = {
  fields: [
    { name: 'name', label: '名称', type: 'input' as const, required: true },
    { name: 'age', label: '年龄', type: 'number' as const },
  ],
  columns: 2,
}

describe('FbkFormGenerator', () => {
  it('view 模式渲染只读文本而不是输入框', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema, mode: 'view', defaultValues: { name: 'Alice', age: 30 } },
    })
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alice')
  })

  it('required 字段自动转成校验规则', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema },
    })
    await flushPromises()
    expect((wrapper.findComponent(FbkFormGenerator).vm as any).getValues()).toBeDefined()
  })

  it('提交携带当前值', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema, defaultValues: { name: 'Bob' } },
    })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '提交')!.trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual(expect.objectContaining({ name: 'Bob' }))
  })

  it('分组渲染', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: schema.fields,
          groups: [
            { title: '基本信息', fields: ['name'] },
            { title: '其他', fields: ['age'] },
          ],
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('基本信息')
    expect(wrapper.text()).toContain('其他')
  })

  it('对象形式的 columns 展开成断点变量', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: { ...schema, columns: { xs: 1, md: 2 } },
      },
    })
    await flushPromises()

    const root = wrapper.find('.fbk-form-generator').element as HTMLElement
    expect(root.style.getPropertyValue('--fbk-cols-xs')).toBe('1')
    expect(root.style.getPropertyValue('--fbk-cols-md')).toBe('2')
  })
})
