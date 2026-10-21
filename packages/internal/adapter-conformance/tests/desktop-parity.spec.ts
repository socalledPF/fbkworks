import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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


  /**
   * 日期选择器必须撑满栅格。
   *
   * element-plus 的 .el-date-editor 默认 220px、naive 的 .n-date-picker 默认 203px，
   * 而普通输入框是 width:100%。不约束的话同一行里两种宽度参差不齐
   * （实测 220 vs 508）。这条断言锁定两个适配器的 style.css 里都有宽度规则。
   */
  it('两个适配器的 style.css 都约束了日期选择器宽度', () => {
    const cssOf: Record<string, string> = {
      'element-plus': readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'adapters', 'element-plus', 'src', 'style.css'),
        'utf8',
      ),
      'naive-ui': readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'adapters', 'naive-ui', 'src', 'style.css'),
        'utf8',
      ),
    }
    const selector = { 'element-plus': 'el-date-editor', 'naive-ui': 'n-date-picker' }
    for (const [name] of adapters) {
      const css = cssOf[name]
      const sel = selector[name as keyof typeof selector]
      expect(css, `${name} 的 style.css 缺少日期选择器宽度约束`).toContain(sel)
      // 必须出现 width: 100%，而不是只选择到元素却没给宽度
      const block = css.slice(css.indexOf(`.fbk-form-generator .${sel}`))
      expect(block.slice(0, 200), `${name} 的日期选择器没有 width: 100%`).toContain('width: 100%')
    }
  })


  /**
   * feedback 确认框的按钮间距。
   *
   * 实测三个适配器原本不一致：element-plus 与 vant 都是 0px
   * （按钮紧贴），naive 是 12px。PC 端 element 与 naive 都用于桌面，
   * 这种差异必须消除。统一到 --fbk-spacing-sm（8px）。
   *
   * jsdom 没有布局引擎、量不出实际间距，因此这里断言 CSS 里
   * 确实存在对应规则 —— 配合浏览器实测脚本一起守住。
   */
  it('两个桌面适配器的 style.css 都约束了确认框按钮间距', () => {
    const cases: Record<string, { file: string; selector: string }> = {
      'element-plus': { file: 'element-plus', selector: '.el-message-box__btns' },
      'naive-ui': { file: 'naive-ui', selector: '--n-action-space' },
    }

    for (const [name] of adapters) {
      const { file, selector } = cases[name]
      const css = readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'adapters', file, 'src', 'style.css'),
        'utf8',
      )
      expect(css, `${name} 缺少确认框按钮间距规则`).toContain(selector)
      // 必须引用间距令牌，而不是写死像素
      expect(css, `${name} 的确认框间距应使用 --fbk-spacing-sm`).toContain('--fbk-spacing-sm')
    }
  })

  /**
   * Playground 的控件必须使用设计系统令牌。
   *
   * 它是评审环境：控件本身是浏览器默认样式（Arial / 13.33px）时，
   * 就没法判断组件到底好不好看。断言样式表里对原生 select/button
   * 显式声明了字体与字号。
   */
  it('Playground 控件显式声明了字体与字号', () => {
    const css = readFileSync(
      join(import.meta.dirname, '..', '..', '..', '..', 'apps', 'playground', 'src', 'playground.css'),
      'utf8',
    )
    // 找到 select/button 的规则块
    const block = css.slice(css.indexOf('.playground__field select'))
    expect(block.slice(0, 600)).toContain('font-family: var(--fbk-font-family)')
    expect(block.slice(0, 600)).toContain('font-size: var(--fbk-font-size-md)')
  })


  /**
   * 组件样式不得压过业务方自己的类。
   *
   * ProTable 的批量条曾用 `.fbk-pro-table__bulk button`（特异性 0,2,1）
   * 给裸 button 兜底，结果把 demo 的 `.fbk-demo-btn`（0,1,0）压掉了 ——
   * 表现为「明明加了类却没生效」：字号变 12px、圆角变 2px。
   *
   * 兜底样式必须限定在「完全没有类名」的元素上，
   * 业务方一旦给了类，外观就该完全由那个类决定。
   */
  it('ProTable 的批量条兜底样式只作用于无类名按钮', () => {
    const css = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'components', 'src', 'pro-table', 'style.css'),
      'utf8',
    )
    // 找到批量条里针对 button 的规则
    const matches = [...css.matchAll(/\.fbk-pro-table__bulk\s+button([^{]*)\{/g)]
    expect(matches.length, '找不到批量条的 button 规则').toBeGreaterThan(0)
    for (const m of matches) {
      const qualifier = m[1].trim()
      expect(
        qualifier,
        `批量条 button 规则缺少 :not([class]) 限定，会压过业务方的类（实际是 "${qualifier}"）`,
      ).toContain(':not([class])')
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
