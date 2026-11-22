import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { h, reactive } from 'vue'
import type { FbkRule } from '@fbkworks/adapter-core'
import { mountWithProvider } from '@fbkworks/test-utils'
import { naiveUiAdapter } from '../src'

/**
 * ⑦ FormItem 的规则构建器以前恒把 `{}` 当 model 交给 validator —— 而契约
 * （adapter-core/contracts/form.ts 的 FbkRule.validator(value, model)）和
 * 文档都说第二个参数是表单 model，于是「两次密码一致」这类跨字段校验永远不成立。
 * ⑤ clearValidate(props) 在 naive-ui / vant 上把参数丢掉，变成全清。
 * 下面就是这两件事的可执行契约。
 */

const Form = naiveUiAdapter.primitives.Form as any
const FormItem = naiveUiAdapter.primitives.FormItem as any

const mountForm = (
  model: Record<string, any>,
  rules: Record<string, FbkRule[]>,
  items: string[],
) =>
  mountWithProvider(Form, {
    adapter: naiveUiAdapter,
    props: { model, rules },
    slots: {
      default: () =>
        items.map((prop) =>
          h(
            FormItem,
            { key: prop, prop, label: prop },
            { default: () => h('input', { class: 'fbk-test-input' }) },
          ),
        ),
    },
  })

const formOf = (wrapper: any) => wrapper.findComponent(Form).vm as any

/** 当前渲染出来的错误文案（顺序 = DOM 顺序，即字段声明顺序） */
const errorTexts = (wrapper: any) =>
  Array.from(wrapper.element.querySelectorAll('.n-form-item-feedback--error') as NodeListOf<HTMLElement>).map((el) =>
    (el.textContent ?? '').trim(),
  )

describe('naive-ui Form/FormItem：validator 的第二个参数是表单 model（⑦）', () => {
  it('validator 收到真实 model，两次密码一致时校验通过', async () => {
    const model = reactive({ password: 'p@ssw0rd', confirmPassword: 'p@ssw0rd' })
    const received: Record<string, any>[] = []
    const wrapper = mountForm(
      model,
      {
        confirmPassword: [
          {
            validator: (_value: unknown, m: Record<string, any>) => {
              received.push(m)
              return m.password === m.confirmPassword ? true : '两次密码不一致'
            },
          },
        ],
      },
      ['password', 'confirmPassword'],
    )
    await flushPromises()

    await formOf(wrapper).validate()

    expect(received.length, 'validator 没有被调用').toBeGreaterThan(0)
    expect(received[0], 'validator 的第二个参数不是表单 model').toBe(model)
    wrapper.unmount()
  })

  it('两次密码不一致时校验不通过（model 真的参与了判断）', async () => {
    const model = reactive({ password: 'p@ssw0rd', confirmPassword: 'p@ssw0rX' })
    const wrapper = mountForm(
      model,
      {
        confirmPassword: [
          {
            validator: (_value: unknown, m: Record<string, any>) =>
              m.password === m.confirmPassword ? true : '两次密码不一致',
          },
        ],
      },
      ['password', 'confirmPassword'],
    )
    await flushPromises()

    await expect(formOf(wrapper).validate()).rejects.toBeTruthy()
    wrapper.unmount()
  })
})

describe('naive-ui Form：clearValidate(props) 按名清理（⑤）', () => {
  it('clearValidate("a") 只清 a 的错误，b 的错误仍在', async () => {
    const model = reactive({ a: '', b: '' })
    const wrapper = mountForm(
      model,
      {
        a: [{ required: true, message: 'a 必填' }],
        b: [{ required: true, message: 'b 必填' }],
      },
      ['a', 'b'],
    )
    await flushPromises()
    const vm = formOf(wrapper)

    await expect(vm.validate()).rejects.toBeTruthy()
    await flushPromises()
    expect(errorTexts(wrapper), '两条错误都应先出现').toEqual(['a 必填', 'b 必填'])

    vm.clearValidate('a')
    await flushPromises()
    expect(errorTexts(wrapper), 'clearValidate("a") 不该把 b 的错误也清掉').toEqual(['b 必填'])

    vm.clearValidate()
    await flushPromises()
    expect(errorTexts(wrapper), '不传参数应该清全部').toEqual([])
    wrapper.unmount()
  })
})
