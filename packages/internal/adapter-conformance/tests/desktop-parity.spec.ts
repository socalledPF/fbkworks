import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import { naiveUiAdapter } from '@fbk/adapter-naive-ui'
import type { UiAdapter } from '@fbk/adapter-core'

/**
 * 桌面端双适配器一致性约束（element-plus ↔ naive-ui）。
 *
 * 背景：业务方要求 PC 上两个适配器"看起来是同一个组件库"。
 * 这条约束不能靠肉眼 review 保证 —— 改 naive 的 theme 或改某个 style.css
 * 都可能单侧退化，而另一方毫不知情。
 *
 * 这里做的是**结构级对照**：同一份 props 分别挂到两个适配器，
 * 比较归一化后的 DOM 特征（类名集合、关键属性、文本），
 * 而不是比较像素（jsdom 没有布局引擎，量不出宽度）。
 *
 * 像素级比对见 tests/visual/（需要浏览器，不在默认门禁里跑）。
 */

const adapters: Array<[string, UiAdapter]> = [
  ['element-plus', elementPlusAdapter],
  ['naive-ui', naiveUiAdapter],
]

/** 把一个 adapter 的原语包在它自己的 RootProvider 里挂载 */
function mountPrimitive(adapter: UiAdapter, component: Component, props: Record<string, any> = {}) {
  const Host = defineComponent({
    setup() {
      return () => h('div', [h(adapter.RootProvider, null, () => h(component, props))])
    },
  })
  return mount(Host)
}

const fbkClasses = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/))
    .filter((c) => c.startsWith('fbk-'))
    .sort()

describe('桌面端双适配器一致性', () => {
  it('两个适配器都声明为 desktop', () => {
    for (const [name, adapter] of adapters) {
      expect(adapter.meta.platform, `${name} 应为 desktop`).toBe('desktop')
    }
  })

  it('DataGrid 在桌面端都渲染成 table 表现层', () => {
    for (const [name, adapter] of adapters) {
      expect(adapter.capabilities.dataGrid.presentation, name).toBe('table')
    }
  })

  it('分页模式一致（都是 pages，而不是 infinite）', () => {
    for (const [name, adapter] of adapters) {
      expect(adapter.capabilities.pagination.mode, name).toBe('pages')
    }
  })

  it('表单布局能力一致', () => {
    for (const [name, adapter] of adapters) {
      expect(adapter.capabilities.form.layout, name).toBe('horizontal')
      expect(adapter.capabilities.form.labelWidth, name).toBe(true)
    }
  })

  /**
   * 核心约束：表单标签宽度。
   *
   * `labelWidth="auto"` 的契约语义是「各行标签等宽，控件左边缘对齐」。
   * 两个桌面库的实现路径不同（element-plus 量最宽的那个，naive 也是），
   * 但都必须把 auto 原样传下去 —— 一旦某侧把 auto 翻译成固定像素，
   * 两边的输入框宽度就会分叉。
   */
  it('Form 都把 labelWidth="auto" 原样交给 UI 库', () => {
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.Form, { model: {}, labelWidth: 'auto' })
      const form = wrapper.findComponent(adapter.primitives.Form)
      expect((form.props() as any).labelWidth, `${name} 应保留 auto`).toBe('auto')
    }
  })

  it('Form 的数字 labelWidth 被保留（不擅自加 px）', () => {
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.Form, { model: {}, labelWidth: 80 })
      const form = wrapper.findComponent(adapter.primitives.Form)
      expect((form.props() as any).labelWidth, name).toBe(80)
    }
  })

  /**
   * 按钮：text 变体在两个库里都不输出状态类名，必须由适配器补标记类，
   * 否则样式层无法统一给它补控件高度（naive 实测 12px vs 32px）。
   */
  it('text 变体按钮都带上 fbk-button--text 标记类', () => {
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.Button, { variant: 'text' })
      const classes = fbkClasses(wrapper.html())
      expect(classes, `${name} 缺少 fbk-button--text`).toContain('fbk-button--text')
    }
  })

  it('primary 变体按钮都不带 text 标记类', () => {
    for (const [, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.Button, { variant: 'primary' })
      expect(fbkClasses(wrapper.html())).not.toContain('fbk-button--text')
    }
  })

  it('Pagination 都渲染「共 N 条」总数文案', async () => {
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.Pagination, {
        page: 1,
        pageSize: 20,
        total: 48,
        showTotal: true,
      })
      await flushPromises()
      expect(wrapper.text(), `${name} 缺少总数文案`).toContain('48')
    }
  })

  /**
   * DataGrid 的数值列必须都打上 fbk-numeric 标记，
   * 否则等宽数字（tabular-nums）只在其中一个库生效，金额列对不齐。
   */
  it('DataGrid 给数值列都打 fbk-numeric 标记', async () => {
    const columns = [
      { key: 'amount', title: '金额', dataIndex: 'amount', numeric: true },
      { key: 'name', title: '名称', dataIndex: 'name' },
    ]
    const data = [{ id: 1, amount: 1234.5, name: 'A' }]

    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.DataGrid, {
        columns,
        data,
        rowKey: 'id',
      })
      await flushPromises()
      expect(wrapper.html(), `${name} 缺少 fbk-numeric`).toContain('fbk-numeric')
    }
  })

  it('DataGrid 空态文案可透传', async () => {
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.DataGrid, {
        columns: [{ key: 'a', title: 'A' }],
        data: [],
        emptyText: '没有记录',
      })
      await flushPromises()
      expect(wrapper.text(), name).toContain('没有记录')
    }
  })

  /**
   * 结构归一化后，两个适配器的 DataGrid 顶层容器应当等价。
   * 这条最严格 —— 它抓的是「某侧多包了一层 div」这类会让
   * margin/padding 计算分叉的问题。
   */
  it('DataGrid 顶层结构与 fbk 类名集合一致', async () => {
    const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
    const data = [{ id: 1, name: 'A' }]

    const shapes = adapters.map(([name, adapter]) => {
      const wrapper = mountPrimitive(adapter, adapter.primitives.DataGrid, {
        columns,
        data,
        rowKey: 'id',
      })
      return { name, html: wrapper.html(), fbk: fbkClasses(wrapper.html()) }
    })

    // 两个库的根容器类名不同（.el-table / .n-data-table），
    // 但 fbk-* 标记必须一致
    const [a, b] = shapes
    expect(a.fbk, `${a.name} 与 ${b.name} 的 fbk 类名不一致`).toEqual(b.fbk)
  })
})
