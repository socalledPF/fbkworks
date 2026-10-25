import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountWithAdapter } from '@fbk/test-utils'
import { useDetail } from '../src/detail-page/use-detail'
import FbkDetailPage from '../src/detail-page/DetailPage.vue'

/**
 * 详情页。
 *
 * 核心承诺（与 CrudPage 一致的那部分）：
 *   · 三态表现固定：骨架 / Result(error) / Result(404)
 *   · null 是 404，不是错误 —— 这个区分很关键
 *   · 失败自动上报，不要求业务方手接
 *   · 竞态：快速切换 id 时旧响应被丢弃
 */

const items = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'amount', label: '金额', dataIndex: 'amount' },
]

const mountPage = (props: Record<string, any> = {}) =>
  mountWithAdapter(FbkDetailPage, {
    props: { request: async () => ({ orderNo: 'SO001', amount: 100 }), items, ...props },
    attachTo: document.body,
  })

describe('三态渲染', () => {
  it('加载中显示骨架，不显示「加载中」文字', async () => {
    let resolve: (v: any) => void
    const request = () => new Promise((r) => (resolve = r))

    const wrapper = mountPage({ request })
    await nextTick()

    expect(wrapper.find('.fbk-detail-page__skeleton').exists()).toBe(true)
    // 骨架不是文字：文字会闪，骨架不会
    expect(wrapper.text()).not.toContain('加载中')

    resolve!({ orderNo: 'SO001' })
    await flushPromises()
    wrapper.unmount()
  })

  it('加载成功后渲染字段', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('SO001')
    expect(wrapper.text()).toContain('订单号')
    wrapper.unmount()
  })

  it('失败时渲染 Result 的 error 态', async () => {
    const wrapper = mountPage({
      request: async () => {
        throw new Error('网络炸了')
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('网络炸了')
    wrapper.unmount()
  })

  it('返回 null 时渲染 404，而不是「加载失败」', async () => {
    const wrapper = mountPage({ request: async () => null })
    await flushPromises()

    expect(wrapper.text()).toContain('内容不存在')
    // 关键：null 不是错误
    expect(wrapper.text()).not.toContain('加载失败')
    wrapper.unmount()
  })

  it('错误态提供重试按钮', async () => {
    let calls = 0
    const wrapper = mountPage({
      request: async () => {
        calls++
        if (calls === 1) throw new Error('第一次失败')
        return { orderNo: 'SO002' }
      },
    })
    await flushPromises()

    const retry = wrapper.find('.fbk-detail-page__btn')
    expect(retry.exists()).toBe(true)

    await retry.trigger('click')
    await flushPromises()

    // 重试后成功
    expect(wrapper.text()).toContain('SO002')
    wrapper.unmount()
  })
})

describe('标题', () => {
  it('字符串标题', async () => {
    const wrapper = mountPage({ title: '订单详情' })
    await flushPromises()
    expect(wrapper.text()).toContain('订单详情')
    wrapper.unmount()
  })

  it('函数标题可用数据里的字段', async () => {
    const wrapper = mountPage({ title: (d: any) => `订单 ${d.orderNo}` })
    await flushPromises()
    expect(wrapper.text()).toContain('订单 SO001')
    wrapper.unmount()
  })
})

describe('插槽', () => {
  it('extra 插槽收到 data', async () => {
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ orderNo: 'SO001' }), items },
      slots: {
        extra: ({ data }: any) => h('div', { class: 'custom-extra' }, `id=${data.orderNo}`),
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('.custom-extra').text()).toBe('id=SO001')
    wrapper.unmount()
  })

  it('actions 插槽收到 data', async () => {
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ orderNo: 'SO001' }), items },
      slots: {
        actions: () => h('button', { class: 'custom-action' }, '编辑'),
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('.custom-action').exists()).toBe(true)
    wrapper.unmount()
  })

  it('没有 extra 插槽时不渲染空容器', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.fbk-detail-page__extra').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('事件', () => {
  it('加载成功后 emit load', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.emitted('load')).toBeTruthy()
    expect(wrapper.emitted('load')![0]![0]).toMatchObject({ orderNo: 'SO001' })
    wrapper.unmount()
  })

  it('失败时 emit error', async () => {
    const wrapper = mountPage({
      request: async () => {
        throw new Error('boom')
      },
    })
    await flushPromises()

    expect(wrapper.emitted('error')).toBeTruthy()
    wrapper.unmount()
  })
})

describe('expose', () => {
  it('暴露 reload', async () => {
    let calls = 0
    const wrapper = mountPage({
      request: async () => {
        calls++
        return { orderNo: `SO${calls}` }
      },
    })
    await flushPromises()

    expect(typeof (wrapper.vm as any).reload).toBe('function')
    await (wrapper.vm as any).reload()
    await flushPromises()

    expect(calls).toBe(2)
    wrapper.unmount()
  })
})

describe('useDetail composable', () => {
  it('可独立使用（自定义模板场景）', async () => {
    const Comp = defineComponent({
      setup() {
        const { data, loading, error } = useDetail({
          fetcher: async () => ({ id: 1 }),
        })
        return () =>
          h('div', [
            h('span', { class: 'loading' }, String(loading.value)),
            h('span', { class: 'data' }, data.value ? String(data.value.id) : ''),
            h('span', { class: 'error' }, error.value ? 'has-error' : ''),
          ])
      },
    })

    const wrapper = mount(Comp, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('.data').text()).toBe('1')
    wrapper.unmount()
  })

  it('null 不算错误', async () => {
    const onError = vi.fn()
    const Comp = defineComponent({
      setup() {
        const { error } = useDetail({ fetcher: async () => null, onError })
        return () => h('div', { class: 'state' }, error.value ? 'error' : 'ok')
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('.state').text()).toBe('ok')
    expect(onError).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
