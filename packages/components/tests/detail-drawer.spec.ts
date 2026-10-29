import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { ADAPTER_CONTEXT, createAdapterContext } from '@fbk/adapter-core'
import { createMockAdapter, mountWithAdapter } from '@fbk/test-utils'
import { FbkDetailDrawer } from '../src/detail-drawer'
import * as pkgBarrel from '../src/index'

/**
 * 详情抽屉。
 *
 * 它自己**不实现**字段渲染与三态：内部整体复用 FbkDetailPage（同一次
 * useDetail 请求、同一套 DescriptionItem 与 field-* 插槽），只负责
 * 「装进哪种原语容器、多宽、朝哪边滑出」。
 *
 * jsdom 没有布局引擎（offsetWidth / getComputedStyle 的媒体查询都不可靠），
 * 所以「桌面 480px、移动端全屏」这一组只断言**传给 Drawer 原语的
 * placement / width**，不断言像素结果。真正的视觉由适配器的 style.css 负责。
 */

const items = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'amount', label: '金额', dataIndex: 'amount' },
]

const mountDrawer = (props: Record<string, any> = {}, slots: Record<string, any> = {}) =>
  mountWithAdapter(FbkDetailDrawer, {
    props: {
      show: true,
      title: '订单详情',
      request: async () => ({ orderNo: 'SO001', amount: 100 }),
      items,
      ...props,
    },
    slots,
    attachTo: document.body,
  })

/** 抽屉原语（mock 适配器）收到的 props —— 布局断言就落在这里 */
const drawerPrimitive = (wrapper: any) => wrapper.findComponent({ name: 'MockDrawer' })

const clickButton = async (wrapper: any, text: string) => {
  const btn = wrapper.findAll('button').find((b: any) => b.text() === text)
  if (!btn) throw new Error(`找不到按钮「${text}」`)
  await btn.trigger('click')
  await flushPromises()
}

/* ---- 视口替身 ----
   jsdom 的 matchMedia 恒返回 matches:false 且不派发 change，
   这里给出可手动切换的替身，顺便记录查询串（用来钉住 639 而不是 640）。 */
type Listener = (event: { matches: boolean }) => void

const originalMatchMedia = window.matchMedia

function mockViewport(matches: boolean) {
  let current = matches
  const queries: string[] = []
  const listeners = new Set<Listener>()

  window.matchMedia = ((query: string) => {
    queries.push(query)
    return {
      get matches() {
        return current
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, cb: Listener) => listeners.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      dispatchEvent: () => false,
    }
  }) as any

  return {
    queries,
    listenerCount: () => listeners.size,
    set(next: boolean) {
      current = next
      listeners.forEach((cb) => cb({ matches: next }))
    },
  }
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('打开与数据', () => {
  it('打开时显示 title 与字段', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    expect(drawerPrimitive(wrapper).exists()).toBe(true)
    expect(drawerPrimitive(wrapper).attributes('data-title')).toBe('订单详情')
    expect(wrapper.text()).toContain('订单号')
    expect(wrapper.text()).toContain('SO001')
    expect(wrapper.text()).toContain('100')
    wrapper.unmount()
  })

  it('show 为 false 时抽屉原语不渲染内容', async () => {
    const wrapper = mountDrawer({ show: false })
    await flushPromises()

    /* findComponent 找得到 MockDrawer 本身（它被挂载了，只是 render 出 null），
       所以这里断言的是**渲染结果**：DOM 里没有抽屉。 */
    expect(wrapper.find('[data-fbk-part="drawer"]').exists()).toBe(false)
    // 且原语确实收到受控的 false，而不是「收到了 true 但自己不渲染」
    expect((drawerPrimitive(wrapper).props() as any).modelValue).toBe(false)
    wrapper.unmount()
  })

  it('request 返回 null 时显示 404 态，而不是空白也不是「加载失败」', async () => {
    const wrapper = mountDrawer({ request: async () => null })
    await flushPromises()

    expect(wrapper.text()).toContain('内容不存在')
    expect(wrapper.text()).not.toContain('加载失败')
    // 409/404 之外，字段区不该出现
    expect(wrapper.find('.fbk-descriptions').exists()).toBe(false)
    wrapper.unmount()
  })

  it('请求失败时显示错误态且可重试', async () => {
    let calls = 0
    const wrapper = mountDrawer({
      request: async () => {
        calls++
        if (calls === 1) throw new Error('网络炸了')
        return { orderNo: 'SO002', amount: 1 }
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败')
    await clickButton(wrapper, '重试')

    expect(wrapper.text()).toContain('SO002')
    wrapper.unmount()
  })

  it('重新打开会重新取详情（不是上一行的数据）', async () => {
    let row = 'SO001'
    let calls = 0
    const wrapper = mountDrawer({
      show: false,
      request: async () => {
        calls++
        return { orderNo: row, amount: calls }
      },
    })
    await flushPromises()

    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(wrapper.text()).toContain('SO001')

    await wrapper.setProps({ show: false })
    await flushPromises()

    row = 'SO002'
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(wrapper.text()).toContain('SO002')
    expect(wrapper.text()).not.toContain('SO001')
    expect(calls).toBe(2)
    wrapper.unmount()
  })

  it('函数 title 用最新数据渲染', async () => {
    const wrapper = mountDrawer({ title: (d: any) => `订单 ${d.orderNo}` })
    await flushPromises()

    expect(drawerPrimitive(wrapper).attributes('data-title')).toBe('订单 SO001')
    wrapper.unmount()
  })
})

describe('字段渲染复用 DetailPage', () => {
  it('field- 前缀插槽覆盖单个字段的渲染', async () => {
    const wrapper = mountDrawer({}, {
      'field-amount': ({ value }: any) => h('span', { class: 'custom-amount' }, `¥${value}`),
    })
    await flushPromises()

    expect(wrapper.find('.custom-amount').text()).toBe('¥100')
    // 只覆盖被点名的字段，其它字段照旧渲染
    expect(wrapper.text()).toContain('SO001')
    wrapper.unmount()
  })

  it('groups 与 bordered 透传给 Descriptions（同一套字段机制）', async () => {
    const wrapper = mountDrawer({
      bordered: true,
      groups: [{ key: 'g', title: '分组' }],
      items: [
        { key: 'orderNo', label: '订单号', dataIndex: 'orderNo', groups: ['g'] },
        { key: 'amount', label: '金额', dataIndex: 'amount', groups: ['g'] },
      ],
    })
    await flushPromises()

    expect(wrapper.find('.fbk-descriptions__grid.fbk-descriptions--bordered').exists()).toBe(true)
    expect(wrapper.text()).toContain('分组')
    wrapper.unmount()
  })

  it('extra 插槽收到数据', async () => {
    const wrapper = mountDrawer({}, {
      extra: ({ data }: any) => h('div', { class: 'custom-extra' }, `id=${data.orderNo}`),
    })
    await flushPromises()

    expect(wrapper.find('.custom-extra').text()).toBe('id=SO001')
    wrapper.unmount()
  })
})

describe('响应式布局（断言传给原语的 props，不断言像素）', () => {
  it('桌面：placement=right、width 默认 480', async () => {
    mockViewport(false)
    const wrapper = mountDrawer()
    await flushPromises()

    const props = drawerPrimitive(wrapper).props() as Record<string, any>
    expect(props.placement).toBe('right')
    expect(props.width).toBe(480)
    wrapper.unmount()
  })

  it('width prop 覆盖桌面默认宽度', async () => {
    mockViewport(false)
    const wrapper = mountDrawer({ width: 720 })
    await flushPromises()

    expect((drawerPrimitive(wrapper).props() as any).width).toBe(720)
    wrapper.unmount()
  })

  it('移动端（≤639px）：placement=bottom 且宽度铺满', async () => {
    const viewport = mockViewport(true)
    const wrapper = mountDrawer()
    await flushPromises()

    const props = drawerPrimitive(wrapper).props() as Record<string, any>
    expect(props.placement).toBe('bottom')
    expect(props.width).toBe('100%')
    // 断点与仓库 CSS 一致是 639 而不是 640
    expect(viewport.queries).toContain('(max-width: 639px)')
    wrapper.unmount()
  })

  it('视口跨过断点后 props 跟随变化', async () => {
    const viewport = mockViewport(false)
    const wrapper = mountDrawer()
    await flushPromises()
    expect((drawerPrimitive(wrapper).props() as any).placement).toBe('right')

    viewport.set(true)
    await nextTick()
    expect((drawerPrimitive(wrapper).props() as any).placement).toBe('bottom')
    expect((drawerPrimitive(wrapper).props() as any).width).toBe('100%')

    viewport.set(false)
    await nextTick()
    expect((drawerPrimitive(wrapper).props() as any).placement).toBe('right')
    wrapper.unmount()
  })

  it('卸载后移除 matchMedia 监听', async () => {
    const viewport = mockViewport(false)
    const wrapper = mountDrawer()
    await flushPromises()
    expect(viewport.listenerCount()).toBe(1)

    wrapper.unmount()
    expect(viewport.listenerCount()).toBe(0)
  })

  it('没有 matchMedia 的环境退化为桌面，而不是渲染不出来', async () => {
    // 模拟 SSR / 极老 WebView：window.matchMedia 不存在
    ;(window as any).matchMedia = undefined
    const wrapper = mountDrawer()
    await flushPromises()

    expect(drawerPrimitive(wrapper).exists()).toBe(true)
    expect((drawerPrimitive(wrapper).props() as any).placement).toBe('right')
    expect(wrapper.text()).toContain('SO001')
    wrapper.unmount()
  })

  it('showClose / closeOnClickModal 透传给原语', async () => {
    const wrapper = mountDrawer({ showClose: false, closeOnClickModal: false })
    await flushPromises()

    const props = drawerPrimitive(wrapper).props() as Record<string, any>
    expect(props.showClose).toBe(false)
    expect(props.closeOnClickModal).toBe(false)
    // 关掉关闭控件后原语就不该有关闭按钮
    expect(wrapper.find('[data-fbk-part="drawer-close"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('展开为整页的出口', () => {
  it('点「展开为整页」emit expand，payload 带当前数据', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await clickButton(wrapper, '展开为整页')

    const emitted = wrapper.emitted('expand')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toMatchObject({ orderNo: 'SO001' })
    wrapper.unmount()
  })

  it('组件自己不导航（不碰 location / history）', async () => {
    const before = window.location.href
    const wrapper = mountDrawer()
    await flushPromises()
    await clickButton(wrapper, '展开为整页')

    expect(window.location.href).toBe(before)
    wrapper.unmount()
  })

  it('expandText 可改文案', async () => {
    const wrapper = mountDrawer({ expandText: '打开完整页' })
    await flushPromises()

    await clickButton(wrapper, '打开完整页')
    expect(wrapper.emitted('expand')).toBeTruthy()
    wrapper.unmount()
  })

  it('showExpand: false 时不渲染出口，也不留空的操作区', async () => {
    const wrapper = mountDrawer({ showExpand: false })
    await flushPromises()

    const labels = wrapper.findAll('button').map((b: any) => b.text())
    expect(labels).not.toContain('展开为整页')
    // 操作区只靠它撑起半条边框，没有按钮就不该留着
    expect(wrapper.find('.fbk-detail-page__actions').exists()).toBe(false)
    wrapper.unmount()
  })

  it('业务方的 actions 插槽与出口共用一个操作区', async () => {
    const wrapper = mountDrawer({}, {
      actions: () => h('button', { class: 'custom-action' }, '编辑'),
    })
    await flushPromises()

    expect(wrapper.find('.custom-action').exists()).toBe(true)
    const row = wrapper.find('.fbk-detail-page__actions')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('展开为整页')
    wrapper.unmount()
  })
})

describe('受控关闭', () => {
  it('点关闭 emit update:show(false) 与 close', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('[data-fbk-part="drawer-close"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('原语主动关闭（遮罩 / ESC）同样翻译成 update:show(false)', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    drawerPrimitive(wrapper).vm.$emit('update:modelValue', false)
    await flushPromises()

    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('v-model:show 双向绑定可用', async () => {
    const Host = {
      template: `
        <FbkDetailDrawer
          v-model:show="visible"
          title="订单详情"
          :request="request"
          :items="items"
        />
      `,
      data: () => ({
        visible: true,
        request: async () => ({ orderNo: 'SO001', amount: 100 }),
        items,
      }),
    }
    const ctx = createAdapterContext({ adapter: createMockAdapter() })
    const wrapper = mount(Host as any, {
      global: {
        provide: { [ADAPTER_CONTEXT as symbol]: ctx },
        components: { FbkDetailDrawer },
      },
      attachTo: document.body,
    } as any)
    await flushPromises()

    expect(wrapper.find('[data-fbk-part="drawer"]').exists()).toBe(true)
    await wrapper.find('[data-fbk-part="drawer-close"]').trigger('click')
    await flushPromises()
    expect((wrapper.vm as any).visible).toBe(false)
    expect(wrapper.find('[data-fbk-part="drawer"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('expose', () => {
  it('暴露 data / reload / close', async () => {
    let calls = 0
    const wrapper = mountDrawer({
      request: async () => {
        calls++
        return { orderNo: `SO00${calls}`, amount: calls }
      },
    })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.data).toMatchObject({ orderNo: 'SO001' })
    expect(typeof vm.reload).toBe('function')
    expect(typeof vm.close).toBe('function')

    await vm.reload()
    await flushPromises()
    expect(calls).toBe(2)
    expect(vm.data).toMatchObject({ orderNo: 'SO002' })

    vm.close()
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})

describe('barrel 导出', () => {
  it('包 barrel 导出 FbkDetailDrawer', () => {
    expect(pkgBarrel.FbkDetailDrawer).toBe(FbkDetailDrawer)
  })
})
