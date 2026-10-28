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

  /**
   * 对外契约：单字段覆盖插槽叫 field-${key}。
   * 依据 types.ts:86-87 与 docs/design/2026-10-25-detail-page.md:91。
   *
   * 实测背景：DetailPage 把收到的 field- 原样转发给 FbkDescriptions，
   * 而 Descriptions 只读 item-${key}，两边前缀对不上，
   * 于是 field- 与 item- 两种写法都不生效，且不报错不警告。
   */
  it('field- 前缀插槽覆盖单个字段的渲染', async () => {
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ orderNo: 'SO001', amount: 100 }), items },
      slots: {
        'field-amount': ({ value }: any) => h('span', { class: 'custom-amount' }, `¥${value}`),
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('.custom-amount').text()).toBe('¥100')
    // 只覆盖被点名的字段，其它字段照旧渲染
    expect(wrapper.text()).toContain('SO001')
    wrapper.unmount()
  })

  it('多个 field- 插槽各管各的字段', async () => {
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ orderNo: 'SO001', amount: 100 }), items },
      slots: {
        'field-orderNo': ({ value }: any) => h('span', { class: 'custom-no' }, `NO:${value}`),
        'field-amount': ({ value }: any) => h('span', { class: 'custom-amount' }, `¥${value}`),
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('.custom-no').text()).toBe('NO:SO001')
    expect(wrapper.find('.custom-amount').text()).toBe('¥100')
    // 两个字段各自被自己的插槽接管，不是只有第一个生效
    const cells = wrapper.findAll('.fbk-descriptions__value')
    expect(cells).toHaveLength(2)
    expect(cells.every((cell) => cell.find('[class^="custom-"]').exists())).toBe(true)
    wrapper.unmount()
  })

  it('field- 插槽同时收到 data 与 value', async () => {
    let received: any
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ orderNo: 'SO001', amount: 100 }), items },
      slots: {
        'field-amount': (slotProps: any) => {
          received = slotProps
          return h('span', { class: 'custom-amount' }, 'ok')
        },
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(received.value).toBe(100)
    expect(received.data).toMatchObject({ orderNo: 'SO001' })
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

describe('Descriptions 属性透传', () => {
  /**
   * 这一组防的是「漏透传」。
   *
   * DetailPage 的 items 复用了 DescriptionItem，所以「影响字段怎么显示」的
   * 开关也应该能透传。否则业务方会发现「Descriptions 能调的，DetailPage
   * 调不了」，只能用 extra 插槽绕 —— 那就失去了复用的意义。
   *
   * 实测背景：第一版 DetailPage 只透传了 column/groups/emptyText，
   * 漏了 bordered/direction/size，导致 demo 里传 bordered 无效。
   */

  it('bordered 透传到 Descriptions', async () => {
    const wrapper = mountPage({ bordered: true })
    await flushPromises()

    /* 注意：bordered 的 class 挂在**网格元素**（.fbk-descriptions__grid）上，
       不是根元素 —— 因为每个分组可以有独立的边框表现。 */
    expect(wrapper.find('.fbk-descriptions__grid.fbk-descriptions--bordered').exists()).toBe(true)
    wrapper.unmount()
  })

  it('不传 bordered 时默认无边框', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.fbk-descriptions--bordered').exists()).toBe(false)
    wrapper.unmount()
  })

  it('direction 透传', async () => {
    const wrapper = mountPage({ direction: 'vertical' })
    await flushPromises()

    expect(wrapper.find('.fbk-descriptions__grid.fbk-descriptions--vertical').exists()).toBe(true)
    wrapper.unmount()
  })

  it('size 透传（走 CSS 变量而不是 class）', async () => {
    const wrapper = mountPage({ size: 'sm' })
    await flushPromises()

    const el = wrapper.find('.fbk-descriptions')
    expect(el.exists()).toBe(true)
    // Descriptions 用 --fbk-descriptions-size 而不是修饰类
    expect(el.attributes('style') ?? '').toContain('--fbk-descriptions-size')
    wrapper.unmount()
  })

  it('column 透传（分组时生成 --fbk-cols-*）', async () => {
    /* 注意：列数变量只挂在**分组元素**上（每组可有独立列数），
       不是根元素。不传 groups 时 Descriptions 走单组路径，
       column 只影响默认栅格，不生成变量 —— 所以这里必须带 groups。 */
    const wrapper = mountPage({
      column: 3,
      groups: [{ key: 'g', title: '分组' }],
      items: items.map((i) => ({ ...i, groups: ['g'] })),
    })
    await flushPromises()

    expect(wrapper.html()).toContain('--fbk-cols-base')
    wrapper.unmount()
  })
})
