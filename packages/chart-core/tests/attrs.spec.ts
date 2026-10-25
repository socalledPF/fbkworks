import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * attrs 转发回归（chart-core）。
 *
 * FbkChart 声明了 inheritAttrs: false —— 这是对的，组件要自己决定 attrs 落点。
 * 但代价是必须手动 useAttrs() + 在模板根元素上 v-bind="attrs"，
 * 漏掉时调用方的 class / style / data-* 会**静默失效**：不报错，只是不生效。
 *
 * 表驱动：新增组件时在这里补一行。漏补会让「表覆盖全部导出」那条用例变红。
 */

vi.mock('echarts/core', () => ({ init: vi.fn() }))
vi.mock('../src/register', () => ({
  registerFbkCharts: vi.fn(),
  isFbkChartsRegistered: () => true,
}))

import * as FbkChartCore from '../src/index'

const PROBE_CLASS = 'fbk-attrs-probe'
const PROBE_ATTR = 'data-attrs-probe'
const PROBE_STYLE = 'height:300px;margin-top:7px'

/**
 * 注入包的真实样式表：jsdom 会做级联计算，所以
 * 「外部 style 覆盖 .fbk-chart 的 height 令牌」可以被实测断言。
 */
const CHART_CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'style.css'), 'utf8')

interface AttrsCase {
  /** 组件名，与包导出一一对应 */
  name: string
  component: Component
  /** 渲染出根元素所需的最小 props */
  props: Record<string, any>
  /** 组件自身写在根元素上的 class：用来确认外部 class 是合并而不是覆盖 */
  ownClass: string
}

const CASES: AttrsCase[] = [
  {
    // 单根 <div class="fbk-chart">，它同时是 .fbk-chart__canvas（position: absolute）的定位容器
    name: 'FbkChart',
    component: FbkChartCore.FbkChart,
    props: { option: { series: [{ type: 'line', data: [1, 2, 3] }] } },
    ownClass: 'fbk-chart',
  },
]

/** 用一层宿主组件模拟真实调用方：class / style / data-* 由父级传入 */
const probeHost = (target: AttrsCase, style: string | Record<string, string> = PROBE_STYLE) =>
  defineComponent({
    name: 'FbkAttrsProbeHost',
    setup: () => () =>
      h(target.component, {
        ...target.props,
        class: PROBE_CLASS,
        style,
        [PROBE_ATTR]: 'yes',
      }),
  })

beforeAll(() => {
  const tag = document.createElement('style')
  tag.textContent = CHART_CSS
  document.head.appendChild(tag)
})

describe('attrs 转发', () => {
  it('表覆盖包内全部组件导出', () => {
    const exported = Object.keys(FbkChartCore)
      .filter((name) => name.startsWith('Fbk'))
      .sort()

    expect(CASES.map((item) => item.name).sort()).toEqual(exported)
  })

  for (const testCase of CASES) {
    it(`${testCase.name}：class / style / data-* 落在根元素上`, async () => {
      const wrapper = mount(probeHost(testCase), { attachTo: document.body })
      await flushPromises()

      const root = wrapper.element as HTMLElement

      expect(root.classList.contains(PROBE_CLASS), '外部 class 未到达根元素').toBe(true)
      expect(root.classList.contains(testCase.ownClass), '外部 class 覆盖了组件自身 class').toBe(true)
      expect(getComputedStyle(root).marginTop, '外部 style 未到达根元素').toBe('7px')
      expect(root.getAttribute(PROBE_ATTR), '外部 data-* 未到达根元素').toBe('yes')

      wrapper.unmount()
    })
  }
})

describe('FbkChart 根元素（canvas 的定位容器）', () => {
  const mountWithStyle = (style: string, props: Record<string, any> = {}) =>
    mount(FbkChartCore.FbkChart, {
      props: { option: { series: [{ type: 'line', data: [1] }] }, ...props },
      attrs: { class: 'from-outside', style },
      attachTo: document.body,
    })

  it('外部 style 的高度生效，且根元素是 canvas 的定位容器', async () => {
    const wrapper = mountWithStyle('height:300px')
    await flushPromises()

    const root = wrapper.element as HTMLElement
    const canvas = root.querySelector('.fbk-chart__canvas') as HTMLElement

    // 外部 height 覆盖 .fbk-chart 的 var(--fbk-chart-height) 默认高度
    expect(getComputedStyle(root).height, '外部 style 未影响布局').toBe('300px')
    // 根元素必须是定位容器，否则 position:absolute; inset:0 的 canvas 会相对更外层定位
    expect(getComputedStyle(root).position).toBe('relative')
    expect(canvas.parentElement, 'canvas 不是根元素的直接子节点').toBe(root)
    expect(getComputedStyle(canvas).position).toBe('absolute')

    wrapper.unmount()
  })

  it('height prop 与外部 style 合并，冲突时 prop 优先', async () => {
    const wrapper = mountWithStyle('height:300px;margin-top:7px', { height: 240 })
    await flushPromises()

    const root = wrapper.element as HTMLElement

    // 显式 prop 的优先级高于透传的 style（与 ScreenPanel 的合并顺序一致）
    expect(root.style.height).toBe('240px')
    // 不冲突的外部样式仍然保留
    expect(root.style.marginTop).toBe('7px')

    wrapper.unmount()
  })
})
