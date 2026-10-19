import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, provide } from 'vue'
import { naiveUiAdapter } from '../src'
import { PAGINATION_SUFFIX } from '../src/locale-context'

/**
 * element-plus 与 naive-ui 的视觉一致性约定。
 *
 * 用户要求桌面端两个适配器视觉一致（vant 是移动端，允许不同）。
 * 这里锁定几条**容易再次退化**的约定 —— 它们都在本轮修复过，
 * 且都不是「改一行就完事」的：
 *   · naive 的 text 按钮不输出类名，必须由适配器补标记类
 *   · naive 的分页没有总数文案，必须由适配器渲染
 *   · 表单条目不能有 UI 库自带的上下外边距
 *
 * 真实的尺寸比对见 design-preview/compare-adapters.mjs（需要浏览器），
 * 这里只锁结构，跑在 jsdom 里。
 */

const { Button, Pagination } = naiveUiAdapter.primitives

describe('naive-ui 适配器的视觉一致性约定', () => {
  it('text 变体按钮带上 fbk-button--text 标记类', () => {
    // naive 的 text 模式不产生任何类名，样式层无法用 .n-button--text 选中它。
    // 没有这个标记类，文字按钮只剩行高（12px vs element-plus 的 32px）。
    const wrapper = mount(Button as any, {
      props: { variant: 'text' },
      slots: { default: () => '返回' },
    })
    expect(wrapper.find('.n-button').classes()).toContain('fbk-button--text')
  })

  it('非 text 变体不带该标记类', () => {
    const wrapper = mount(Button as any, {
      props: { variant: 'primary' },
      slots: { default: () => '查询' },
    })
    expect(wrapper.find('.n-button').classes()).not.toContain('fbk-button--text')
  })

  it('showTotal 时渲染总数文案', async () => {
    // element-plus 的 layout 里有 'total' 段；naive 没有等价能力。
    // 不补的话两个适配器的分页宽度差 117px。
    const wrapper = mount(Pagination as any, {
      props: { page: 1, pageSize: 20, total: 48, showTotal: true },
    })
    await flushPromises()
    expect(wrapper.find('.fbk-pagination__total').text()).toBe('共 48 条')
  })

  it('showTotal 为 false 时不渲染总数文案', async () => {
    const wrapper = mount(Pagination as any, {
      props: { page: 1, pageSize: 20, total: 48, showTotal: false },
    })
    await flushPromises()
    expect(wrapper.find('.fbk-pagination__total').exists()).toBe(false)
  })

  it('每页条数用 element-plus 的文案格式', async () => {
    // naive 默认把选项渲染成「20 / 页」，element-plus 是「20条/页」。
    // 文案不一致时两个适配器的分页块宽度也差一截（实测 40px）。
    const wrapper = mount(Pagination as any, {
      props: { page: 1, pageSize: 20, total: 48 },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('20条/页')
    expect(wrapper.text()).not.toContain('/ 页')
  })

  it('跳页组尾部渲染 locale 提供的单位字', async () => {
    // element-plus 的跳页是「前往 [1] 页」，naive 只有「跳至 [1]」。
    // 少这一个字，分页块整体窄 18px，右对齐时「共 N 条」跟着右移。
    // 字来自 RootProvider 注入的 locale，所以这里要带 provider 挂载。
    const wrapper = mount(
      defineComponent({
        setup() {
          provide(PAGINATION_SUFFIX, computed(() => '页'))
          return () => h(Pagination as any, { page: 1, pageSize: 20, total: 48, showJumper: true })
        },
      }),
    )
    await flushPromises()
    expect(wrapper.find('.fbk-pagination__suffix').text()).toBe('页')
  })

  it('没有 provider 时不渲染单位字（不硬编码中文）', async () => {
    // 单独 mount 适配器组件时注入是空的。这时不能退回写死的「页」——
    // 英文环境下会冒出中文。宁可不显示。
    const wrapper = mount(Pagination as any, {
      props: { page: 1, pageSize: 20, total: 48, showJumper: true },
    })
    await flushPromises()
    expect(wrapper.find('.fbk-pagination__suffix').exists()).toBe(false)
  })
})
