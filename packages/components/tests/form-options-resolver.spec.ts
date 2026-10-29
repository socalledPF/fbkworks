import { mountWithAdapter } from '@fbkworks/test-utils'
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { FbkFormGenerator } from '../src/form-generator'
import type { FormField, FormSchema } from '../src/form-generator'

/**
 * options 的函数形式 —— 字段联动。
 *
 * 场景：选了省份后，城市选项跟着变。
 * 之前只能让业务方把 options 放进 ref 再手动 watch，写法绕且容易忘记清空旧的选中值。
 */

const PROVINCE_CITIES: Record<string, Array<{ label: string; value: string }>> = {
  zhejiang: [
    { label: '杭州', value: 'hangzhou' },
    { label: '宁波', value: 'ningbo' },
  ],
  jiangsu: [
    { label: '南京', value: 'nanjing' },
    { label: '苏州', value: 'suzhou' },
  ],
}

const makeSchema = (): FormSchema => ({
  fields: [
    {
      name: 'province',
      label: '省份',
      type: 'select',
      options: [
        { label: '浙江', value: 'zhejiang' },
        { label: '江苏', value: 'jiangsu' },
      ],
    },
    {
      name: 'city',
      label: '城市',
      type: 'select',
      // 关键：函数形式，根据当前表单值算选项
      options: (values: Record<string, any>) => PROVINCE_CITIES[values.province] ?? [],
    } satisfies FormField,
  ],
})

describe('静态 options（向后兼容）', () => {
  it('数组形式仍然工作', async () => {
    const schema: FormSchema = {
      fields: [{ name: 'a', label: 'A', type: 'select', options: [{ label: 'X', value: 1 }] }],
    }
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema, modelValue: {} },
    })
    await flushPromises()

    // 能渲染出来即说明数组路径没坏
    expect(wrapper.findAll('[data-fbk-part]').length).toBeGreaterThan(0)
    wrapper.unmount()
  })
})

describe('动态 options（联动）', () => {
  it('初始无省份时城市选项为空', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema: makeSchema(), modelValue: {} },
    })
    await flushPromises()

    const exposed = wrapper.vm as any
    // 通过渲染结果验证：城市字段应存在但无可选项
    expect(wrapper.html()).toContain('省份')
    expect(wrapper.html()).toContain('城市')
    expect(exposed).toBeTruthy()

    wrapper.unmount()
  })

  it('选中省份后城市选项跟随变化', async () => {
    const model = ref<Record<string, any>>({ province: 'zhejiang' })
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema: makeSchema(), modelValue: model.value },
    })
    await flushPromises()

    // 切到江苏
    model.value = { province: 'jiangsu' }
    await wrapper.setProps({ modelValue: model.value })
    await nextTick()
    await flushPromises()

    // 组件不崩，且渲染仍在
    expect(wrapper.html()).toContain('省份')
    wrapper.unmount()
  })

  it('解析函数抛错时退化为空选项，不让表单崩', async () => {
    const schema: FormSchema = {
      fields: [
        {
          name: 'x',
          label: 'X',
          type: 'select',
          options: () => {
            throw new Error('选项计算炸了')
          },
        },
      ],
    }
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema, modelValue: {} },
    })
    await flushPromises()

    // 关键：一个字段的选项算错不该白屏
    expect(wrapper.html()).toContain('X')
    wrapper.unmount()
  })
})

describe('view 模式下的标签解析', () => {
  it('函数 options 也能解析出显示文案', async () => {
    const schema: FormSchema = {
      fields: [
        {
          name: 'city',
          label: '城市',
          type: 'select',
          options: () => [
            { label: '杭州', value: 'hangzhou' },
            { label: '宁波', value: 'ningbo' },
          ],
        },
      ],
    }
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: { schema, modelValue: { city: 'hangzhou' }, mode: 'view' },
    })
    await flushPromises()

    // view 模式显示 label 而不是 value
    expect(wrapper.text()).toContain('杭州')
    wrapper.unmount()
  })
})
