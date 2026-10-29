import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createMockAdapter } from '@fbkworks/test-utils'
import { FbkProvider } from '../src/plugin'
import type { UiAdapter } from '../src'

/**
 * <FbkProvider> 的 attrs 路由。
 *
 * 业务方会在 Provider 上挂主题类 / data-* / style —— 它们必须落到真实 DOM。
 * Provider 自己声明 inheritAttrs: false 并显式转发，不靠 Vue 的隐式 fallthrough：
 * 隐式转发只在「渲染根恰好是单个组件」时成立，根结构一变就静默失效，
 * 而这层静默失效正是 RootProvider 侧丢掉 class 的同源缺陷。
 */

function createStubAdapter(): UiAdapter {
  const adapter = createMockAdapter()
  return {
    ...adapter,
    RootProvider: defineComponent({
      name: 'StubRootProvider',
      // 适配器 RootProvider 同样自己决定 attrs 落点
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        return () => h('div', { ...attrs, 'data-fbk-part': 'root' }, slots.default?.())
      },
    }),
  }
}

const containers: HTMLElement[] = []

function createContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  containers.push(el)
  return el
}

afterEach(() => {
  for (const el of containers.splice(0)) el.remove()
})

describe('<FbkProvider> attrs 转发', () => {
  it('class / data-* 落到 RootProvider 的根元素上', async () => {
    const app = createApp({
      render: () =>
        h(
          FbkProvider,
          { adapter: createStubAdapter(), class: 'provider-probe', 'data-probe': 'p1' },
          { default: () => h('i', { 'data-probe': 'content' }, '内容') },
        ),
    })
    const container = createContainer()
    app.mount(container)
    await nextTick()

    const root = container.querySelector('.provider-probe')
    expect(root, 'class 没有落到任何元素上').not.toBeNull()
    expect(container.querySelector('[data-probe="p1"]')).not.toBeNull()
    // 落点必须是包住内容的那个元素，而不是别处同名元素
    expect(root!.contains(container.querySelector('[data-probe="content"]'))).toBe(true)

    app.unmount()
  })

  it('attrs 由 Provider 自己负责路由（inheritAttrs: false）', () => {
    expect((FbkProvider as any).inheritAttrs).toBe(false)
  })
})
