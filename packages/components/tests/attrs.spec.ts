import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { mountWithAdapter } from '@fbkworks/test-utils'
import * as FbkComponents from '../src/index'

/**
 * attrs 转发回归。
 *
 * 这些组件都声明了 inheritAttrs: false —— 这是对的，组件要自己决定 attrs 落点。
 * 但代价是必须手动 useAttrs() + 在模板根元素上 v-bind="attrs"，
 * 漏掉时调用方的 class / style / data-* 会**静默失效**：不报错，只是不生效。
 *
 * 表驱动：新增组件时在这里补一行。漏补会让「表覆盖全部导出」那条用例变红，
 * 从而不会再有组件悄悄丢掉 attrs。
 */

const PROBE_CLASS = 'fbk-attrs-probe'
const PROBE_ATTR = 'data-attrs-probe'
const PROBE_STYLE = { marginTop: '7px' }

interface AttrsCase {
  /** 组件名，与包导出一一对应 */
  name: string
  component: Component
  /** 渲染出根元素所需的最小 props */
  props: Record<string, any>
}

const emptyRequest = async () => ({ list: [], total: 0 })

const CASES: AttrsCase[] = [
  {
    name: 'FbkCrudPage',
    component: FbkComponents.FbkCrudPage,
    props: { columns: [], request: emptyRequest },
  },
  {
    name: 'FbkDescriptions',
    component: FbkComponents.FbkDescriptions,
    props: { items: [], data: {} },
  },
  {
    name: 'FbkFormGenerator',
    component: FbkComponents.FbkFormGenerator,
    props: { schema: { fields: [] } },
  },
  {
    // 模板根是 <component :is="Dialog">，attrs 必须落在这一层；show 打开才有根元素
    name: 'FbkFormModal',
    component: FbkComponents.FbkFormModal,
    props: { schema: { fields: [] }, submit: async () => {}, show: true },
  },
  {
    name: 'FbkPageContainer',
    component: FbkComponents.FbkPageContainer,
    props: {},
  },
  {
    name: 'FbkProTable',
    component: FbkComponents.FbkProTable,
    props: { columns: [], data: [] },
  },
  {
    name: 'FbkQueryForm',
    component: FbkComponents.FbkQueryForm,
    props: { fields: [] },
  },
  {
    name: 'FbkResult',
    component: FbkComponents.FbkResult,
    props: { status: 'info' },
  },
  {
    // 模板根是 <component :is="Drawer">，show 打开才有渲染结果（关闭时原语返回 null）
    name: 'FbkDetailDrawer',
    component: FbkComponents.FbkDetailDrawer,
    props: { items: [], request: async () => ({}), show: true },
  },
  {
    // 已经写对的参照实现：根是 FbkPageContainer，attrs 一路透传到它的根元素
    name: 'FbkDetailPage',
    component: FbkComponents.FbkDetailPage,
    props: { items: [], request: async () => ({}) },
  },
]

/** 用一层宿主组件模拟真实调用方：class / style / data-* 由父级传入 */
const probeHost = (target: AttrsCase) =>
  defineComponent({
    name: 'FbkAttrsProbeHost',
    setup: () => () =>
      h(target.component, {
        ...target.props,
        class: PROBE_CLASS,
        style: PROBE_STYLE,
        [PROBE_ATTR]: 'yes',
      }),
  })

describe('attrs 转发', () => {
  it('表覆盖包内全部组件导出', () => {
    const exported = Object.keys(FbkComponents)
      .filter((name) => name.startsWith('Fbk'))
      .sort()

    expect(CASES.map((item) => item.name).sort()).toEqual(exported)
  })

  for (const testCase of CASES) {
    it(`${testCase.name}：class / style / data-* 落在根元素上`, async () => {
      const wrapper = mountWithAdapter(probeHost(testCase), { attachTo: document.body })
      await flushPromises()

      const root = wrapper.element as HTMLElement

      expect(root.classList.contains(PROBE_CLASS), '外部 class 未到达根元素').toBe(true)
      expect(root.style.marginTop, '外部 style 未到达根元素').toBe(PROBE_STYLE.marginTop)
      expect(root.getAttribute(PROBE_ATTR), '外部 data-* 未到达根元素').toBe('yes')

      wrapper.unmount()
    })
  }
})
