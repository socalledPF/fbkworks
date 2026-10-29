import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

/**
 * 大屏组件的核心行为。
 *
 * 重点是 ScreenPage 的**等比缩放** —— 它决定大屏在任何分辨率下
 * 构图是否一致。这块逻辑纯计算，可以精确断言。
 */

vi.mock('@fbkworks/chart-core', () => ({
  FbkChart: {
    name: 'FbkChart',
    props: ['option', 'height', 'loading', 'isEmpty', 'emptyText'],
    setup: () => () => h('div', { 'data-fbk-part': 'chart' }),
  },
}))

import FbkScreenPage from '../src/ScreenPage.vue'
import FbkScreenPanel from '../src/ScreenPanel.vue'
import FbkScreenGrid from '../src/ScreenGrid.vue'
import FbkScreenNumber from '../src/ScreenNumber.vue'
import FbkScreenHeader from '../src/ScreenHeader.vue'
import FbkScreenScrollList from '../src/ScreenScrollList.vue'

/** 伪造容器尺寸（jsdom 默认 0） */
function stubRect(width: number, height: number) {
  Element.prototype.getBoundingClientRect = function () {
    return {
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
}

beforeEach(() => {
  stubRect(1920, 1080)
})

describe('ScreenPage 等比缩放', () => {
  it('1920×1080 视口下 scale 为 1', async () => {
    stubRect(1920, 1080)
    const wrapper = mount(FbkScreenPage, { props: {} })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const stage = wrapper.find('.fbk-screen__stage').element as HTMLElement
    expect(stage.style.transform).toContain('scale(1)')
  })

  it('缩到一半时 scale 为 0.5', async () => {
    stubRect(960, 540)
    const wrapper = mount(FbkScreenPage)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const stage = wrapper.find('.fbk-screen__stage').element as HTMLElement
    expect(stage.style.transform).toContain('scale(0.5)')
  })

  it('取 min(scaleX, scaleY) 保证不变形', async () => {
    // 宽 1920、高 540 → scaleX=1, scaleY=0.5 → 应取 0.5
    stubRect(1920, 540)
    const wrapper = mount(FbkScreenPage)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const stage = wrapper.find('.fbk-screen__stage').element as HTMLElement
    expect(stage.style.transform).toContain('scale(0.5)')
  })

  it('超宽视口同样取 min（不拉伸）', async () => {
    // 宽 3840、高 1080 → scaleX=2, scaleY=1 → 应取 1
    stubRect(3840, 1080)
    const wrapper = mount(FbkScreenPage)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const stage = wrapper.find('.fbk-screen__stage').element as HTMLElement
    expect(stage.style.transform).toContain('scale(1)')
  })

  it('stage 尺寸固定为设计稿尺寸', async () => {
    const wrapper = mount(FbkScreenPage, { props: { designWidth: 1600, designHeight: 900 } })
    await flushPromises()
    const stage = wrapper.find('.fbk-screen__stage').element as HTMLElement
    expect(stage.style.width).toBe('1600px')
    expect(stage.style.height).toBe('900px')
  })

  it('transform 里同时包含 translate 与 scale（不能分开写，会互相覆盖）', async () => {
    const wrapper = mount(FbkScreenPage)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const transform = (wrapper.find('.fbk-screen__stage').element as HTMLElement).style.transform
    // 这条防的是"舞台跑到右下角"的回归
    expect(transform).toContain('translate')
    expect(transform).toContain('scale')
  })

  it('fill 模式分别缩放 x/y', async () => {
    stubRect(3840, 1080)
    const wrapper = mount(FbkScreenPage, { props: { mode: 'fill' } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))

    const transform = (wrapper.find('.fbk-screen__stage').element as HTMLElement).style.transform
    expect(transform).toContain('scale(2, 1)')
  })

  it('grid / glow 装饰可关闭', () => {
    const withDecor = mount(FbkScreenPage)
    expect(withDecor.classes()).toContain('fbk-screen--grid')
    expect(withDecor.classes()).toContain('fbk-screen--glow')

    const plain = mount(FbkScreenPage, { props: { grid: false, glow: false } })
    expect(plain.classes()).not.toContain('fbk-screen--grid')
    expect(plain.classes()).not.toContain('fbk-screen--glow')
  })
})

describe('ScreenPanel', () => {
  it('渲染标题', () => {
    const wrapper = mount(FbkScreenPanel, { props: { title: '区域销售' } })
    expect(wrapper.text()).toContain('区域销售')
  })

  it('无标题时不渲染 header', () => {
    const wrapper = mount(FbkScreenPanel)
    expect(wrapper.find('.fbk-screen-panel__header').exists()).toBe(false)
  })

  it('四角装饰默认开启', () => {
    const wrapper = mount(FbkScreenPanel, { props: { title: 'x' } })
    expect(wrapper.classes()).toContain('fbk-screen-panel--corners')
  })

  it('corners 可关闭', () => {
    const wrapper = mount(FbkScreenPanel, { props: { corners: false } })
    expect(wrapper.classes()).not.toContain('fbk-screen-panel--corners')
  })

  it('height 数字补 px', () => {
    const wrapper = mount(FbkScreenPanel, { props: { height: 300 } })
    expect((wrapper.element as HTMLElement).style.height).toBe('300px')
  })

  it('class 透传到根元素（inheritAttrs 转发）', () => {
    const wrapper = mount(FbkScreenPanel, { attrs: { class: 'my-panel' } })
    expect(wrapper.classes()).toContain('my-panel')
  })
})

describe('ScreenGrid', () => {
  it('默认 24 列', () => {
    const wrapper = mount(FbkScreenGrid)
    const el = wrapper.element as HTMLElement
    expect(el.style.gridTemplateColumns).toBe('repeat(24, minmax(0, 1fr))')
  })

  it('columns 可配置', () => {
    const wrapper = mount(FbkScreenGrid, { props: { columns: 12 } })
    expect((wrapper.element as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(12, minmax(0, 1fr))',
    )
  })

  it('rows 写入 gridTemplateRows', () => {
    const wrapper = mount(FbkScreenGrid, { props: { rows: '1fr 2fr' } })
    expect((wrapper.element as HTMLElement).style.gridTemplateRows).toBe('1fr 2fr')
  })

  it('gap 变体渲染对应 class', () => {
    const wrapper = mount(FbkScreenGrid, { props: { gap: 'lg' } })
    expect(wrapper.classes()).toContain('fbk-screen-grid--gap-lg')
  })

  it('外部 class 不被丢弃（这条曾导致布局高度失效）', () => {
    const wrapper = mount(FbkScreenGrid, { attrs: { class: 'screen-main' } })
    expect(wrapper.classes()).toContain('screen-main')
  })
})

describe('ScreenNumber', () => {
  it('渲染千分位数字', () => {
    const wrapper = mount(FbkScreenNumber, { props: { value: 24680 } })
    expect(wrapper.text()).toContain('24,680')
  })

  it('precision 控制小数', () => {
    const wrapper = mount(FbkScreenNumber, { props: { value: 3.14159, precision: 2 } })
    expect(wrapper.text()).toContain('3.14')
  })

  it('prefix / suffix 渲染', () => {
    const wrapper = mount(FbkScreenNumber, { props: { value: 100, prefix: '¥', suffix: '%' } })
    expect(wrapper.text()).toContain('¥')
    expect(wrapper.text()).toContain('%')
  })

  it('size 变体渲染对应 class', () => {
    const wrapper = mount(FbkScreenNumber, { props: { value: 1, size: 'lg' } })
    expect(wrapper.classes()).toContain('fbk-screen-number--lg')
  })
})

describe('ScreenHeader', () => {
  it('渲染标题', () => {
    const wrapper = mount(FbkScreenHeader, { props: { title: '运营监控中心' } })
    expect(wrapper.text()).toContain('运营监控中心')
  })

  it('clock 开启时渲染时间', async () => {
    const wrapper = mount(FbkScreenHeader, { props: { title: 'x', clock: true } })
    await flushPromises()
    expect(wrapper.find('.fbk-screen-header__clock').exists()).toBe(true)
  })

  it('clock 关闭时不渲染时间', () => {
    const wrapper = mount(FbkScreenHeader, { props: { title: 'x', clock: false } })
    expect(wrapper.find('.fbk-screen-header__clock').exists()).toBe(false)
  })

  it('fullscreen 按钮可关闭', () => {
    const on = mount(FbkScreenHeader, { props: { title: 'x', fullscreen: true } })
    expect(on.find('.fbk-screen-header__fullscreen').exists()).toBe(true)

    const off = mount(FbkScreenHeader, { props: { title: 'x', fullscreen: false } })
    expect(off.find('.fbk-screen-header__fullscreen').exists()).toBe(false)
  })

  it('全屏按钮带 aria-label（可访问性）', () => {
    const wrapper = mount(FbkScreenHeader, { props: { title: 'x' } })
    const btn = wrapper.find('.fbk-screen-header__fullscreen')
    expect(btn.attributes('aria-label')).toBeTruthy()
  })

  it('卸载时清理定时器（防泄漏）', () => {
    const spy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = mount(FbkScreenHeader, { props: { title: 'x' } })
    wrapper.unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('ScreenScrollList', () => {
  const items = [
    { label: '告警一', value: '1' },
    { label: '告警二', value: '2' },
    { label: '告警三', value: '3' },
  ]

  it('渲染列表项（内容复制一份用于无缝循环）', () => {
    const wrapper = mount(FbkScreenScrollList, { props: { items } })
    const rows = wrapper.findAll('.fbk-screen-scroll-list__row')
    // items × 2
    expect(rows).toHaveLength(6)
  })

  it('容器高度按 visibleRows × itemHeight 计算', () => {
    const wrapper = mount(FbkScreenScrollList, {
      props: { items, itemHeight: 40, visibleRows: 5 },
    })
    expect((wrapper.element as HTMLElement).style.height).toBe('200px')
  })

  it('空列表不报错', () => {
    const wrapper = mount(FbkScreenScrollList, { props: { items: [] } })
    expect(wrapper.findAll('.fbk-screen-scroll-list__row')).toHaveLength(0)
  })

  it('status 渲染到 data-status（用于状态色圆点）', () => {
    const wrapper = mount(FbkScreenScrollList, {
      props: { items: [{ label: 'x', status: 'danger' as const }] },
    })
    expect(wrapper.find('[data-status="danger"]').exists()).toBe(true)
  })

  it('卸载时清理定时器', () => {
    const spy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = mount(FbkScreenScrollList, { props: { items } })
    wrapper.unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
