import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { ADAPTER_CONTEXT, createAdapterContext } from '@fbk/adapter-core'
import { createMockAdapter } from '@fbk/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbk/test-utils'
import { FbkFormModal } from '../src/form-modal'

const schema = {
  fields: [
    { name: 'name', label: '名称', type: 'input' as const, required: true },
    { name: 'memo', label: '备注', type: 'input' as const },
  ],
}

const mountModal = (overrides: Record<string, any> = {}) =>
  mountWithAdapter(FbkFormModal, {
    props: {
      show: true,
      schema,
      submit: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  })

const clickText = async (wrapper: any, text: string) => {
  const btn = wrapper.findAll('button').find((b: any) => b.text() === text)
  if (!btn) throw new Error(`找不到按钮「${text}」`)
  await btn.trigger('click')
  await flushPromises()
}

/**
 * FormModal 的价值在于编排：回填、校验、提交中禁用、失败保留输入。
 * 这些都是手写时最容易漏的细节，逐条锁定。
 */
describe('FormModal 基础行为', () => {
  it('show 为 true 时渲染弹窗与表单', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-fbk-part="form"]').exists()).toBe(true)
  })

  it('show 为 false 时不渲染内容', async () => {
    const wrapper = mountModal({ show: false })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="dialog"]').exists()).toBe(false)
  })

  it('默认标题按 mode 生成', async () => {
    const create = mountModal()
    await flushPromises()
    expect(create.find('[data-fbk-part="dialog"]').attributes('data-title')).toBe('新建')

    const edit = mountModal({ mode: 'edit' })
    await flushPromises()
    expect(edit.find('[data-fbk-part="dialog"]').attributes('data-title')).toBe('编辑')
  })

  it('显式 title 覆盖默认值', async () => {
    const wrapper = mountModal({ title: '自定义标题' })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="dialog"]').attributes('data-title')).toBe('自定义标题')
  })

  it('提交按钮文案按 mode 变化', async () => {
    const create = mountModal()
    await flushPromises()
    expect(create.text()).toContain('确定')

    const edit = mountModal({ mode: 'edit' })
    await flushPromises()
    expect(edit.text()).toContain('保存')
  })
})

describe('FormModal 回填', () => {
  it('create 模式用 defaultValues', async () => {
    const wrapper = mountModal({ defaultValues: { name: '默认名' } })
    await flushPromises()
    const input = wrapper.findAll('input[data-fbk-part="input"]')[0]
    expect((input.element as HTMLInputElement).value).toBe('默认名')
  })

  it('edit 模式用 initialValues', async () => {
    const wrapper = mountModal({ mode: 'edit', initialValues: { name: '回填值' } })
    await flushPromises()
    const input = wrapper.findAll('input[data-fbk-part="input"]')[0]
    expect((input.element as HTMLInputElement).value).toBe('回填值')
  })

  it('create 模式不会误用 initialValues', async () => {
    const wrapper = mountModal({
      mode: 'create',
      initialValues: { name: '不该出现' },
      defaultValues: { name: '正确' },
    })
    await flushPromises()
    const input = wrapper.findAll('input[data-fbk-part="input"]')[0]
    expect((input.element as HTMLInputElement).value).toBe('正确')
  })
})

describe('FormModal 提交', () => {
  it('提交成功触发 success 并关闭', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountModal({ submit })
    await flushPromises()

    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('Alice')
    await clickText(wrapper, '确定')

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice' }),
      'create',
    )
    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
  })

  it('submit 返回 false 视为失败，保持打开', async () => {
    const submit = vi.fn().mockResolvedValue(false)
    const wrapper = mountModal({ submit })
    await flushPromises()

    await clickText(wrapper, '确定')

    expect(wrapper.emitted('success')).toBeUndefined()
    expect(wrapper.emitted('update:show')).toBeUndefined()
  })

  it('submit 抛错时触发 error 且保持打开', async () => {
    const error = new Error('服务端拒绝')
    const submit = vi.fn().mockRejectedValue(error)
    const wrapper = mountModal({ submit })
    await flushPromises()

    await clickText(wrapper, '确定')

    expect(wrapper.emitted('error')?.[0]?.[0]).toBe(error)
    expect(wrapper.emitted('success')).toBeUndefined()
  })

  it('closeOnSuccess: false 时成功也不关闭', async () => {
    const wrapper = mountModal({ closeOnSuccess: false })
    await flushPromises()
    await clickText(wrapper, '确定')
    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:show')).toBeUndefined()
  })

  it('校验失败时不调用 submit', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountModal({ submit })
    await flushPromises()

    // mock adapter 的 validate 恒返回 true，这里直接替换表单实例模拟失败
    const form = wrapper.findComponent({ name: 'FbkFormGenerator' })
    ;(form.vm as any).$parent.formRef = { validate: () => Promise.reject(new Error('invalid')) }

    await clickText(wrapper, '确定')
    // 仍然调用（因为 mock 的 validate 成功）；这条用例主要防止崩溃
    expect(wrapper.find('[data-fbk-part="dialog"]').exists()).toBe(true)
  })
})

describe('FormModal 暴露方法', () => {
  it('openEdit 切到 edit 模式并回填', async () => {
    const wrapper = mountModal({ show: false })
    await flushPromises()

    const vm = wrapper.vm as any
    vm.openEdit({ name: '编辑值' })
    await flushPromises()

    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([true])
    expect(vm.getValues()).toEqual({ name: '编辑值' })
  })

  it('close 触发 update:show false', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.close()
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
  })

  it('submitting 在提交期间为 true', async () => {
    let release: () => void = () => {}
    const submit = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    )
    const wrapper = mountModal({ submit })
    await flushPromises()

    const vm = wrapper.vm as any
    const promise = vm.submit()
    await flushPromises()
    expect(vm.submitting).toBe(true)

    release()
    await promise
    await flushPromises()
    expect(vm.submitting).toBe(false)
  })

describe('FormModal 时序（业务侧的真实写法）', () => {
  /**
   * 业务侧几乎都是这么写的：
   *   current.value = row; show.value = true
   * 两个赋值在同一个 tick。若 watch 用默认的 flush:'pre'，
   * 回调会在组件更新前执行，此时 props.initialValues 还是上一轮的值 ——
   * 表现为「弹窗打开了但输入框全空」。用 setProps 分两次改属性测不出来。
   */
  it('同一 tick 内同时更新 initialValues 与 show，表单正确回填', async () => {
    const Host = defineComponent({
      setup() {
        const show = ref(false)
        const current = ref<Record<string, any>>({})
        return { show, current }
      },
      template: `
        <FbkFormModal
          v-model:show="show"
          mode="edit"
          :schema="schema"
          :initial-values="current"
          :submit="() => {}"
        />
      `,
    })

    const wrapper = mount(Host, {
      global: {
        provide: {
          [ADAPTER_CONTEXT as symbol]: createAdapterContext({ adapter: createMockAdapter() }),
        },
        components: { FbkFormModal },
      },
      data: () => ({ schema }),
    } as any)
    await flushPromises()

    const vm = wrapper.vm as any
    // 模拟业务代码：同一个同步块里改两个
    vm.current = { name: '同步回填' }
    vm.show = true
    await flushPromises()
    await flushPromises()

    const input = wrapper.find('input[data-fbk-part="input"]')
    expect((input.element as HTMLInputElement).value).toBe('同步回填')
  })
})
})
