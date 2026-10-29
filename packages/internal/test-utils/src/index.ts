import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component, type PropType } from 'vue'
import { ADAPTER_CONTEXT, createAdapterContext, type UiAdapter } from '@fbkworks/adapter-core'
import { createMockAdapter } from './mock-adapter'

export { createMockAdapter, defaultMockCapabilities } from './mock-adapter'

export interface MountWithAdapterOptions {
  adapter?: UiAdapter
  props?: Record<string, any>
  slots?: Record<string, any>
  attachTo?: Element | string
  /** 注入上下文的 locale，用于断言格式化是否跟随语言设置 */
  locale?: string
}

/**
 * 业务组件测试基座：通过真实的 provide/inject 注入 mock adapter。
 * 测试只断言语义（data-fbk-part 标记、事件、请求参数），不依赖任何 UI 库 DOM。
 */
export function mountWithAdapter(
  component: Component,
  options: MountWithAdapterOptions = {},
) {
  const adapter = options.adapter ?? createMockAdapter()
  const ctx = createAdapterContext({ adapter, locale: options.locale })

  // 直接挂载被测组件：这样 wrapper.emitted() 能读到组件自身的事件
  return mount(component, {
    props: options.props,
    slots: options.slots,
    attachTo: options.attachTo,
    global: {
      provide: { [ADAPTER_CONTEXT as symbol]: ctx },
    },
  } as any)
}

/** 适配器契约测试用：把原语包在 RootProvider 中挂载。 */
export function mountWithProvider(
  component: Component,
  options: {
    adapter: UiAdapter
    props?: Record<string, any>
    /** 容器原语（Drawer 等）的默认插槽内容 */
    slots?: Record<string, any>
  },
) {
  const ctx = createAdapterContext({ adapter: options.adapter })
  const Host = defineComponent({
    name: 'FbkProviderTestHost',
    props: { adapterProps: { type: Object as PropType<Record<string, any>>, default: () => ({}) } },
    setup(_props, { slots }) {
      // 外层 div 保证 wrapper.text() / wrapper.element 指向真实元素，
      // 而不是 provider 的 fragment 占位节点。
      // slots 必须继续往下传：Drawer 这类容器原语的契约就是「默认插槽内容要渲染出来」。
      return () =>
        h('div', { 'data-fbk-test-root': '' }, [
          h(options.adapter.RootProvider, _props.adapterProps, () =>
            h(component, options.props, slots),
          ),
        ])
    },
  })
  return mount(Host, {
    slots: options.slots,
    global: { provide: { [ADAPTER_CONTEXT as symbol]: ctx } },
  })
}
