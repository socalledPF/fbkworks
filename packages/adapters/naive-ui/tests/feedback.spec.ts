import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

/**
 * confirm 的 danger 必须产生可观察差异。
 *
 * naive 的 dialog 是命令式的：真实 NDialogProvider 要等用户点击才关闭，
 * 在测试里打开它既看不见参数也永远不 resolve。所以这里 mock useDialog，
 * 直接读「适配器到底把什么参数交给了 naive」—— danger 的差异就落在参数上。
 */
const mocks = vi.hoisted(() => {
  const calls: Array<{ type: string; options: Record<string, any> }> = []
  const record = (type: string) => (options: Record<string, any>) => {
    calls.push({ type, options })
    return { destroy() {} }
  }
  const noop = () => ({ destroy() {} })
  return {
    calls,
    useDialog: () => ({
      create: record('create'),
      success: record('success'),
      warning: record('warning'),
      error: record('error'),
      info: record('info'),
      destroyAll: () => {},
    }),
    useMessage: () => ({ success: noop, warning: noop, error: noop, info: noop }),
  }
})

vi.mock('naive-ui', () => ({
  useDialog: mocks.useDialog,
  useMessage: mocks.useMessage,
}))

const { feedback, installFeedback } = await import('../src/feedback')

describe('adapter: naive-ui / feedback.confirm 的 danger', () => {
  beforeAll(() => {
    mount(
      defineComponent({
        setup() {
          installFeedback()
          return () => h('div')
        },
      }),
    )
  })

  beforeEach(() => {
    mocks.calls.length = 0
  })

  it('danger=true 让确认按钮走危险色，danger=false 不动它', () => {
    void feedback.confirm('确定删除这条记录？', { danger: true })
    void feedback.confirm('确定保存？', { danger: false })

    const [danger, plain] = mocks.calls
    expect(mocks.calls).toHaveLength(2)
    expect(danger.options.positiveButtonProps, 'danger 必须落到确认按钮的配色上').toEqual({
      type: 'error',
    })
    expect(plain.options.positiveButtonProps).toBeUndefined()
    // 参数层面必须可区分，否则 danger 等于空转
    expect(danger.options).not.toEqual(plain.options)
  })

  it('options.type 透传给 dialog 的语义类型', () => {
    void feedback.confirm('已保存', { type: 'success' })
    expect(mocks.calls[0].type).toBe('success')

    // danger 时与 element-plus 一致：图标仍是警示语义，危险色只作用在按钮上
    mocks.calls.length = 0
    void feedback.confirm('删除', { danger: true, type: 'success' })
    expect(mocks.calls[0].type).toBe('warning')
  })
})
