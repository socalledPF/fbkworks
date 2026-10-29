import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'
import type { UiAdapter } from '@fbkworks/adapter-core'

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

/** 两库各自的 DataGrid 根元素类名，只用于在 DOM 里定位 vendor 根 */
const vendorGrid = {
  'element-plus': { prefix: 'el-', root: 'el-table' },
  'naive-ui': { prefix: 'n-', root: 'n-data-table' },
} as const

/**
 * 把「boundary → target」之间的元素链归一化成标签数组。
 *
 * boundary 由调用方传入：DataGrid 组件根元素的父元素，也就是适配器自己开始
 * 负责的那一层。Provider 贡献的包裹层（element 用来承载 attrs 的 div、
 * naive 的 .n-config-provider）不在这个用例的范围内，因此不参与比较。
 *
 * 只留标签名：类名、data-* 属性、行内样式在两库里天然不同
 * （naive 把一批 CSS 变量写在 .n-data-table 的行内 style 上），
 * 它们不构成层级差异，参与比较只会产生假阳性。
 * vendor 自有元素按类名前缀剔除 —— 那段层级由库决定
 * （element 把一张表拆成 header/body 两个 table，naive 是单表 + scrollbar），
 * 与「适配器有没有多包一层」无关。
 */
function shellTags(boundary: HTMLElement, target: HTMLElement, vendorPrefix: string): string[] {
  const tags: string[] = []
  for (let cur = target.parentElement; cur && cur !== boundary; cur = cur.parentElement) {
    const vendorOwned = [...cur.classList].some((c) => c.startsWith(vendorPrefix))
    if (!vendorOwned) tags.unshift(cur.tagName.toLowerCase())
  }
  return tags
}

/**
 * 切分 style.css 的规则块。
 * 先去掉注释：注释里常写着示例规则的 { } 和选择器，会把解析带偏。
 * at-rule（@media 等）只当容器，不作为规则本身返回。
 */
function cssRules(source: string): Array<{ selector: string; body: string }> {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Array<{ selector: string; body: string }> = []
  const open: Array<{ selector: string; from: number }> = []
  let boundary = 0
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      open.push({ selector: css.slice(boundary, i).trim().replace(/\s+/g, ' '), from: i + 1 })
      boundary = i + 1
    } else if (css[i] === '}') {
      const rule = open.pop()
      if (rule && !rule.selector.startsWith('@')) {
        rules.push({ selector: rule.selector, body: css.slice(rule.from, i) })
      }
      boundary = i + 1
    }
  }
  return rules
}

/**
 * 取指定选择器的规则体并解析成「属性 → 值」。
 * 全文件 toContain 会被同文件任意一处满足（--fbk-spacing-sm 就在多处出现），
 * 断言必须落在具体规则块里。
 */
function declarationsOf(css: string, selector: string): Record<string, string> {
  const matched = cssRules(css).filter((rule) => rule.selector === selector)
  expect(matched.length, `style.css 里应恰好有一条 ${selector} 规则`).toBe(1)
  const declarations: Record<string, string> = {}
  for (const part of matched[0].body.split(';')) {
    const at = part.indexOf(':')
    if (at < 0) continue
    declarations[part.slice(0, at).trim()] = part.slice(at + 1).trim().replace(/\s+/g, ' ')
  }
  return declarations
}

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
   * jsdom 没有布局引擎、量不出实际间距，因此断言 CSS 规则本身。
   * 但断言必须落在**具体规则块**上：原先是对整个 style.css 做
   * toContain('--fbk-spacing-sm')，而同文件的 .fbk-pagination__suffix
   * 也用了这个令牌，于是把确认框的 gap 改成写死像素、甚至删掉，
   * 断言照样绿 —— 验证的根本不是这两条规则。
   */
  it('两个桌面适配器的 style.css 都约束了确认框按钮间距', () => {
    const cases: Record<
      string,
      { file: string; rules: Array<{ selector: string; expected: Record<string, string> }> }
    > = {
      'element-plus': {
        file: 'element-plus',
        rules: [
          {
            selector: '.el-message-box__btns',
            expected: { display: 'flex', gap: 'var(--fbk-spacing-sm)' },
          },
        ],
      },
      'naive-ui': {
        file: 'naive-ui',
        rules: [
          {
            selector: '.n-dialog__action',
            expected: { display: 'flex', gap: 'var(--fbk-spacing-sm)' },
          },
          // naive 自带的按钮间距来自行内变量 --n-action-space（默认 12px），必须归零
          { selector: '.n-dialog', expected: { '--n-action-space': '0 !important' } },
        ],
      },
    }

    for (const [name] of adapters) {
      const { file, rules } = cases[name]
      const css = readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'adapters', file, 'src', 'style.css'),
        'utf8',
      )
      for (const { selector, expected } of rules) {
        const declarations = declarationsOf(css, selector)
        for (const [property, value] of Object.entries(expected)) {
          expect(
            declarations[property],
            `${name} 的 ${selector} 应声明 ${property}: ${value}（实际：${declarations[property] ?? '缺失'}）`,
          ).toBe(value)
        }
      }
    }
  })

  /**
   * Playground 的控件应当直接使用 UI 库，而不是手写原生控件。
   *
   * 这条断言的前身是「手写 select 必须显式声明字体与字号」——
   * 那是把方向搞反了：Playground 是**消费方应用**，不受组件库的
   * 零依赖约束，真实项目里没人会手写 `<select>` + appearance:none
   * 再自己画箭头。手写 CSS 去模仿 UI 库，本质是在重新实现已有的东西。
   *
   * 现在断言反过来：顶部控件用 element-plus 的组件，
   * 且 playground.css 里不再残留手写的表单控件样式。
   */
  it('Playground 顶部控件使用 element-plus 而非手写原生控件', () => {
    const app = readFileSync(
      join(import.meta.dirname, '..', '..', '..', '..', 'apps', 'playground', 'src', 'App.vue'),
      'utf8',
    )
    expect(app, '顶部应使用 el-select').toContain('ElSelect')
    expect(app, '顶部应使用 el-switch').toContain('ElSwitch')

    const css = readFileSync(
      join(import.meta.dirname, '..', '..', '..', '..', 'apps', 'playground', 'src', 'playground.css'),
      'utf8',
    )
    // 手写控件样式的特征：自定义箭头、去掉原生外观
    expect(css, 'playground.css 不应再有 appearance: none（那是手写 select 的痕迹）').not.toContain(
      'appearance: none',
    )
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
   * 适配器不得替 vendor 的 DataGrid 再包一层。
   * 多出来的一层会让 margin/padding 计算分叉（业务方给 DataGrid 设的
   * width/height/flex 也会落在错误的那一层上）。
   *
   * 前身比的是「两侧 fbk- 类名集合相等」，可 element-plus 与 naive 的
   * DataGrid 都不产出 fbk- 类名（fbk-numeric 只在 numeric 列上出现，
   * 本用例的 columns 里没有），两边都是 []，toEqual([]) 恒真 ——
   * 给某侧多包一层 div 也照样绿。
   *
   * 现在比的是归一化后的结构层级：从 DataGrid 自己那一层走到 vendor 的 DataGrid 根，
   * 只保留「不属于任何一方 UI 库」的元素，且只留标签名（见 shellTags）。
   */
  it('DataGrid 不在 vendor 根之上额外包裹元素', async () => {
    const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
    const data = [{ id: 1, name: 'A' }]

    const shapes: Array<{ name: string; shell: string[] }> = []
    for (const [name, adapter] of adapters) {
      const wrapper = mountPrimitive(adapter, adapter.primitives.DataGrid, {
        columns,
        data,
        rowKey: 'id',
      })
      await flushPromises()
      /* 边界取 DataGrid 组件根元素的父元素：包一层 div 会让组件根变成那个 div，
         父元素仍然是同一个 —— 边界本身不受变异影响，层级差就落在被比较的区间里。 */
      const gridRoot = wrapper.findComponent(adapter.primitives.DataGrid).element as HTMLElement
      const boundary = gridRoot.parentElement
      expect(boundary, `${name} 的 DataGrid 根元素没有父元素`).toBeTruthy()
      const { prefix, root } = vendorGrid[name as keyof typeof vendorGrid]
      const all = [...(wrapper.element as HTMLElement).querySelectorAll<HTMLElement>('*')]
      const vendorRoot = all.find((el) => el.classList.contains(root))
      expect(vendorRoot, `${name} 没能定位到 vendor 的 DataGrid 根元素 .${root}`).toBeTruthy()
      shapes.push({ name, shell: shellTags(boundary!, vendorRoot!, prefix) })
    }

    for (const { name, shell } of shapes) {
      expect(
        shell,
        `${name} 在 vendor 的 DataGrid 根之上多了包裹元素：${shell.join(' > ') || '（无）'}`,
      ).toEqual([])
    }
    const [a, b] = shapes
    expect(a.shell, `${a.name} 与 ${b.name} 的 DataGrid 包裹层级不一致`).toEqual(b.shell)
  })
})
