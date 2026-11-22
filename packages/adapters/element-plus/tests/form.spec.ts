import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { h, reactive } from 'vue'
import type { FbkRule } from '@fbkworks/adapter-core'
import { mountWithProvider } from '@fbkworks/test-utils'
import { elementPlusAdapter } from '../src'

/**
 * ⑦ FormItem 的规则构建器以前恒把 `{}` 当 model 交给 validator —— 而契约
 * （adapter-core/contracts/form.ts 的 FbkRule.validator(value, model)）和文档都说
 * 第二个参数是表单 model，于是「两次密码一致」这类跨字段校验永远不成立。
 * ⑤ clearValidate(props) 必须按名转发（element-plus 本来就是对的，这里只锁住语义）。
 *
 * 为什么不跑 `ElForm.validate()` 做端到端断言：本仓库的 jsdom + element-plus
 * 2.14.7 里 element-plus 的表单校验本来就不工作 —— 用**原样的** ElForm/ElFormItem
 * （完全不经过本适配器）配一条 { required: true } 规则实测：表单项永远停在
 * is-validating，而 ElForm.validate() resolve true（ElFormItem.validate 的 reject
 * 值里没有 fields，ElForm.doValidateField 就把它当成通过）。
 * 这是库/测试环境的既有问题，与本任务无关，也不是这里引入的。
 * 所以 (a) 直接驱动适配器映射出来的那份 validator —— 那正是本次改动的代码。
 */

const Form = elementPlusAdapter.primitives.Form as any
const FormItem = elementPlusAdapter.primitives.FormItem as any

const mountForm = (
  model: Record<string, any>,
  rules: Record<string, FbkRule[]>,
  items: string[],
  itemRules?: Record<string, FbkRule[]>,
) =>
  mountWithProvider(Form, {
    adapter: elementPlusAdapter,
    props: { model, rules },
    slots: {
      default: () =>
        items.map((prop) =>
          h(
            FormItem,
            { key: prop, prop, label: prop, rules: itemRules?.[prop] },
            { default: () => h('input', { class: 'fbk-test-input' }) },
          ),
        ),
    },
  })

const formOf = (wrapper: any) => wrapper.findComponent(Form).vm as any

/** 适配器映射给 element-plus 的规则（表单级在 ElForm.rules，条目级在 ElFormItem.rules） */
const formRule = (wrapper: any, prop: string) =>
  (wrapper.findComponent({ name: 'ElForm' }).props('rules') as any)[prop][0]

const itemRule = (wrapper: any, index: number) =>
  (wrapper.findAllComponents({ name: 'ElFormItem' })[index].props('rules') as any)[0]

describe('element-plus Form/FormItem：validator 的第二个参数是表单 model（⑦）', () => {
  it('表单级规则：validator 收到真实 model，两次密码一致时通过', async () => {
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

    const callback = vi.fn()
    formRule(wrapper, 'confirmPassword').validator(undefined, model.confirmPassword, callback)

    expect(received.length, 'validator 没有被调用').toBeGreaterThan(0)
    expect(received[0], 'validator 的第二个参数不是表单 model').toBe(model)
    expect(callback, '两次密码一致时不该报错').toHaveBeenCalledWith()
    wrapper.unmount()
  })

  it('表单级规则：两次密码不一致时回调收到 Error（model 真的参与了判断）', async () => {
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

    const callback = vi.fn()
    formRule(wrapper, 'confirmPassword').validator(undefined, model.confirmPassword, callback)

    const error = callback.mock.calls[0]?.[0]
    expect(error, '不一致时必须回调 Error').toBeInstanceOf(Error)
    expect(String(error.message)).toBe('两次密码不一致')
    wrapper.unmount()
  })

  it('条目级规则：FormItem 也能通过 inject 拿到真实 model', async () => {
    const model = reactive({ password: 'p@ssw0rd', confirmPassword: 'p@ssw0rd' })
    const received: Record<string, any>[] = []
    const rule: FbkRule = {
      validator: (_value: unknown, m: Record<string, any>) => {
        received.push(m)
        return m.password === m.confirmPassword ? true : '两次密码不一致'
      },
    }
    const wrapper = mountForm(model, {}, ['password', 'confirmPassword'], {
      confirmPassword: [rule],
    })
    await flushPromises()

    const callback = vi.fn()
    itemRule(wrapper, 1).validator(undefined, model.confirmPassword, callback)

    expect(received[0], '条目级规则拿到的不是表单 model').toBe(model)
    expect(callback, '两次密码一致时不该报错').toHaveBeenCalledWith()
    wrapper.unmount()
  })
})

describe('element-plus Form：clearValidate(props) 按名清理（⑤）', () => {
  it('clearValidate("a") 只派发给 a 的表单项，不传清全部', async () => {
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

    /* ElForm.clearValidate 先把名字过滤成表单项再逐个调 clearValidate()。
       所以「只清了指定的那几个」可以直接从表单项的调用上看出来，不依赖 DOM。 */
    const [fieldA, fieldB] = (wrapper.findComponent({ name: 'ElForm' }).vm as any).fields
    const clearA = vi.spyOn(fieldA, 'clearValidate')
    const clearB = vi.spyOn(fieldB, 'clearValidate')
    const vm = formOf(wrapper)

    vm.clearValidate('a')
    expect(clearA, 'clearValidate("a") 必须清 a').toHaveBeenCalled()
    expect(clearB, 'clearValidate("a") 不该动 b').not.toHaveBeenCalled()

    clearA.mockClear()
    clearB.mockClear()
    vm.clearValidate(['a', 'b'])
    expect(clearA).toHaveBeenCalled()
    expect(clearB).toHaveBeenCalled()

    clearA.mockClear()
    clearB.mockClear()
    vm.clearValidate()
    expect(clearA, '不传参数应该清全部').toHaveBeenCalled()
    expect(clearB, '不传参数应该清全部').toHaveBeenCalled()
    wrapper.unmount()
  })
})
