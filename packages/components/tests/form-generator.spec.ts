import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
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

  it('switch 字段走适配器 Checkbox 原语，而不是裸 input', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: { fields: [{ name: 'enabled', label: '启用', type: 'switch' as const }] },
        defaultValues: { enabled: false },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-fbk-part="checkbox"]').exists()).toBe(true)
    await wrapper.find('[data-fbk-part="checkbox"] input').setValue(true)
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({ enabled: true }),
    )
  })

  it('字段 uiProps.disabled 能覆盖表单级 disabled', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [
            { name: 'name', label: '名称', type: 'input' as const, uiProps: { disabled: true } },
          ],
        },
        // 表单整体不禁用，只有这一个字段禁
      },
    })
    await flushPromises()
    const input = wrapper.find('input[data-fbk-part="input"]')
    expect(input.attributes('disabled')).toBeDefined()
  })

  it('字段级 disabled 函数按当前值求值', async () => {
    // 已提交的订单不允许再改名 —— disabled 依赖同表单的另一个字段
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [
            { name: 'locked', label: '已锁定', type: 'switch' as const },
            {
              name: 'name',
              label: '名称',
              type: 'input' as const,
              disabled: (model: Record<string, any>) => Boolean(model.locked),
            },
          ],
        },
        defaultValues: { locked: true, name: 'Alice' },
      },
    })
    await flushPromises()

    const input = wrapper.find('input[data-fbk-part="input"]')
    expect(input.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-fbk-part="checkbox"] input').setValue(false)
    expect(wrapper.find('input[data-fbk-part="input"]').attributes('disabled')).toBeUndefined()
  })
})
