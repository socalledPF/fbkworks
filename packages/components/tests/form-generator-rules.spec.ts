import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbk/test-utils'
import { FbkFormGenerator } from '../src/form-generator'

/**
 * 校验规则必须真正到达 FormItem。
 *
 * 此前的实现把 required / field.rules 算进了 `rules` computed，
 * 但模板里的 FormItem 没有绑定 :rules —— 于是 validate() 永远返回 true，
 * 必填项形同虚设。这类缺陷不报错、不警告，只有真的去提交才发现。
 */
describe('FormGenerator 校验规则传递', () => {
  const formItemProps = (wrapper: any) =>
    wrapper.findAllComponents({ name: 'MockFormItem' }).map((item: any) => item.props())

  it('required 字段的规则传给了 FormItem', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [{ name: 'name', label: '名称', type: 'input' as const, required: true }],
        },
      },
    })
    await flushPromises()

    const [item] = formItemProps(wrapper)
    expect(item.rules, 'FormItem 没收到 rules').toBeTruthy()
    expect(item.rules[0]).toEqual(expect.objectContaining({ required: true }))
  })

  it('字段级 rules 传给了 FormItem', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [
            {
              name: 'age',
              label: '年龄',
              type: 'number' as const,
              rules: [{ min: 18, message: '必须成年' }],
            },
          ],
        },
      },
    })
    await flushPromises()

    const [item] = formItemProps(wrapper)
    expect(item.rules).toEqual([{ min: 18, message: '必须成年' }])
  })

  it('schema 级 rules 与字段级合并，不是互相覆盖', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          rules: { name: [{ max: 10, message: '太长' }] },
          fields: [{ name: 'name', label: '名称', type: 'input' as const, required: true }],
        },
      },
    })
    await flushPromises()

    const [item] = formItemProps(wrapper)
    const messages = item.rules.map((r: any) => r.message)
    expect(messages).toContain('名称不能为空')
    expect(messages).toContain('太长')
  })

  it('没有规则的字段不传空数组（避免无谓的校验分支）', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: { fields: [{ name: 'memo', label: '备注', type: 'input' as const }] },
      },
    })
    await flushPromises()

    const [item] = formItemProps(wrapper)
    expect(item.rules).toBeUndefined()
  })

  it('required 与字段级 rules 同时存在时都要保留', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [
            {
              name: 'code',
              label: '编码',
              type: 'input' as const,
              required: true,
              rules: [{ pattern: /^[A-Z]+$/, message: '只能大写' }],
            },
          ],
        },
      },
    })
    await flushPromises()

    const [item] = formItemProps(wrapper)
    expect(item.rules).toHaveLength(2)
    expect(item.rules[0]).toEqual(expect.objectContaining({ required: true }))
    expect(item.rules[1]).toEqual(expect.objectContaining({ message: '只能大写' }))
  })
})
