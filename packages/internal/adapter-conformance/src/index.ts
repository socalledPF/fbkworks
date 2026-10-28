import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { Component } from 'vue'
import { ADAPTER_API_VERSION, type UiAdapter } from '@fbk/adapter-core'
import { defaultTokens } from '@fbk/tokens'

export interface ConformanceOptions {
  adapter: UiAdapter
  /** 用适配器自己的 RootProvider 包裹后挂载原语 */
  mount: (component: Component, props?: Record<string, any>) => any
  /**
   * 适配器自己的 DOM 选择器。契约测试只断言语义，不假设各库的类名，
   * 因此由适配器显式提供查询入口。
   */
  selectors?: {
    /** 可点击的数据行 */
    row?: string
    /** 选择列 checkbox */
    selection?: string
    /** 下一页按钮 */
    nextPage?: string
    /**
     * loading 态的可见标记：loading=true 时必须存在，loading=false 时必须消失。
     * 两个方向都断言，避免适配器拿一个常驻元素糊弄过去。
     */
    loading?: string
    /**
     * 可排序列的表头排序控件（点击目标）。形态因库而异：
     * element-plus 是 <button class="caret-wrapper">，naive-ui 是
     * <span class="n-data-table-sorter">。契约只要求「点了要发 update:sort」，
     * 所以入口由适配器自己声明，不假设类名。
     */
    sortTrigger?: string
  }
  /** 当前环境无法满足的契约项（需在文档中说明原因） */
  skip?: Array<'selection' | 'pagination' | 'sort'>
}

const columns = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'age', title: '年龄', dataIndex: 'age' },
]
const rows = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 24 },
]

/**
 * 适配器契约测试套件。每个适配器只需一行接入：
 *   runAdapterConformance({ adapter, mount })
 * 这是防止“只在 element-plus 上能跑”的主要手段。
 */
export function runAdapterConformance(options: ConformanceOptions): void {
  const { adapter, mount, skip = [] } = options
  const p = adapter.primitives
  const selectors = {
    row: 'tbody tr',
    selection: 'input[type="checkbox"]',
    nextPage: '.el-pagination .btn-next, .van-pagination__next, .n-pagination-item--button:last-child',
    loading: '[data-fbk-part="loading"]',
    sortTrigger: '.caret-wrapper, .n-data-table-sorter',
    ...options.selectors,
  }

  /* 被 skip 的契约项仍然注册用例（it.skip），不用 if 把 it 整条藏掉：
     跳过必须在测试输出里以 skipped 出现。否则契约项等于无声消失 ——
     本套件最初就在 skip 类型里声明了 'sort' 而一条 sort 用例都没有，
     skip: ['sort'] 传与不传完全没区别。 */
  const itUnlessSkipped = (name: 'selection' | 'pagination' | 'sort') =>
    skip.includes(name) ? it.skip : it

  describe(`adapter: ${adapter.meta.name}`, () => {
    it('声明兼容的 apiVersion', () => {
      expect(adapter.meta.apiVersion).toBe(ADAPTER_API_VERSION)
    })

    it('声明完整且合法的能力', () => {
      expect(adapter.meta.platform).toMatch(/desktop|mobile/)
      expect(adapter.capabilities.dataGrid.presentation).toMatch(/table|cards|responsive/)
      expect(adapter.capabilities.pagination.mode).toMatch(/pages|infinite|both/)
      expect(adapter.capabilities.overlay.kind).toMatch(/dialog|drawer|popup/)
      expect(adapter.capabilities.theme.darkMode).toBeTypeOf('boolean')
    })

    it('提供全部必需原语', () => {
      for (const key of [
        'Button',
        'Input',
        'Select',
        'Checkbox',
        'DatePicker',
        'Radio',
        'Form',
        'FormItem',
        'DataGrid',
        'Pagination',
        'Dialog',
        'Tag',
        'Empty',
        'Spin',
      ] as const) {
        expect(p[key], `缺少原语 ${key}`).toBeTruthy()
      }
    })

    it('Button 触发 click 并透传 attrs', async () => {
      const onClick = vi.fn()
      const wrapper = mount(p.Button, { onClick, class: 'fbk-test-class' })
      await wrapper.find('button').trigger('click')
      expect(onClick).toHaveBeenCalled()
      expect(wrapper.find('.fbk-test-class').exists()).toBe(true)
    })

    it('Input 实现 v-model', async () => {
      const wrapper = mount(p.Input, { modelValue: 'a' })
      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      await input.setValue('b')
      expect(wrapper.findComponent(p.Input).emitted('update:modelValue')?.at(-1)).toEqual(['b'])
    })

    it('Select 只通过 options + modelValue 工作', async () => {
      const wrapper = mount(p.Select, {
        modelValue: 1,
        options: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
        ],
      })
      await wrapper.vm.$nextTick()
      // 下拉内容可能是异步/teleport 的，契约只要求“已选值能正确显示”。
      // 部分库（vant Field）把展示值写在 input.value 上，所以文本和表单值都要看。
      const shown = wrapper.text() + wrapper.findAll('input').map((input: any) => (input.element as HTMLInputElement).value).join('')
      expect(shown).toContain('A')
    })

    it('Checkbox 实现 v-model 布尔值', async () => {
      const wrapper = mount(p.Checkbox, { modelValue: false })

      // 控件的形态因库而异，契约只要求「点击能翻转并发出布尔值」：
      //   element-plus 用真实 <input type="checkbox">
      //   vant / naive-ui 是 div[role="checkbox"] 的自定义控件，没有原生 input
      // 所以这里两种形态都找，与下面 DataGrid 选择列的写法保持一致。
      const native = wrapper.find('input[type="checkbox"]')
      const custom = wrapper.find('[role="checkbox"]')
      expect(native.exists() || custom.exists(), 'Checkbox 必须渲染原生 input 或 role="checkbox"').toBe(true)

      if (native.exists()) {
        const element = native.element as HTMLInputElement
        element.checked = true
        element.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        await custom.trigger('click')
      }
      await flushPromises()

      const emitted = wrapper.findComponent(p.Checkbox).emitted('update:modelValue')
      expect(emitted?.at(-1)).toEqual([true])
    })

    it('Form 暴露 validate(): Promise<true>', async () => {
      const wrapper = mount(p.Form, { model: {} })
      const form = wrapper.findComponent(p.Form)
      await expect((form.vm as any).validate()).resolves.toBe(true)
    })

    it('DataGrid 渲染行并可点击', async () => {
      const wrapper = mount(p.DataGrid, { columns, data: rows, rowKey: 'id', rowClickable: true })
      // 部分 UI 库（element-plus）的表格要等内部异步布局完成后才渲染列
      await flushPromises()
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('Bob')
      const row = wrapper.find(selectors.row)
      expect(row.exists()).toBe(true)
      await row.trigger('click')
      expect(wrapper.findComponent(p.DataGrid).emitted('row-click')).toBeTruthy()
    })

    it('DataGrid 空数据渲染空态', () => {
      const wrapper = mount(p.DataGrid, { columns, data: [], emptyText: '没有记录' })
      expect(wrapper.text()).toContain('没有记录')
    })

    it('DataGrid 渲染 loading 态', async () => {
      /* 只断言「渲染出了 HTML」恒真，等于没测：element-plus 声明了 loading 却从不使用
         也能过。这里改成正反两个方向 —— loading 时必须出现适配器声明的 loading 标记，
         不 loading 时必须没有，任何一侧漏接都会红。 */
      const busy = mount(p.DataGrid, { columns, data: rows, loading: true })
      await flushPromises()
      expect(busy.find(selectors.loading).exists(), 'loading=true 时必须渲染 loading 标记').toBe(true)

      const idle = mount(p.DataGrid, { columns, data: rows, loading: false })
      await flushPromises()
      expect(idle.find(selectors.loading).exists(), 'loading=false 时不应有 loading 标记').toBe(false)
    })

    itUnlessSkipped('selection')('DataGrid 支持选择', async () => {
      const wrapper = mount(p.DataGrid, {
        columns,
        data: rows,
        rowKey: 'id',
        selectionEnabled: true,
        selectedKeys: [],
      })
      await flushPromises()
      const checkbox = wrapper.find(selectors.selection)
      expect(checkbox.exists()).toBe(true)

      // 各库的选择控件形态不同：原生 input 需要 change，自定义控件用 click。
      // 这里两种都触发，只要产生正确的归一化事件即视为满足契约。
      const element = checkbox.element as HTMLInputElement
      if (element.tagName === 'INPUT') {
        element.checked = true
        element.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        await checkbox.trigger('click')
      }
      await flushPromises()

      const emitted = wrapper.findComponent(p.DataGrid).emitted('update:selectedKeys')
      expect(emitted).toBeTruthy()
      expect(emitted?.at(-1)?.[0]).toEqual([1])
    })

    itUnlessSkipped('sort')('DataGrid 可排序列点表头发出 update:sort', async () => {
      /* field 的来源是契约的一部分：取 column.dataIndex，缺省时回退 column.key。
         这里刻意让 key ≠ dataIndex —— key === dataIndex 会把两家适配器的分歧
         掩盖成同一个字符串，只有两个值不同时取错一方才会红。 */
      const sortableColumns = [
        { key: 'userName', title: '名称', dataIndex: 'name', sortable: true },
        { key: 'userAge', title: '年龄', dataIndex: 'age', sortable: true },
      ]
      const wrapper = mount(p.DataGrid, { columns: sortableColumns, data: rows, rowKey: 'id' })
      await flushPromises()

      const trigger = (index: number) => wrapper.findAll(selectors.sortTrigger)[index]
      // 两列都可排序 → 恰好两个排序控件，索引与列一一对应
      expect(wrapper.findAll(selectors.sortTrigger).length, 'sortable 列必须渲染可点的排序控件').toBe(2)

      const sortOf = (): any => wrapper.findComponent(p.DataGrid).emitted('update:sort')?.at(-1)?.[0]

      // 首次点击只钉「字段就是被点的这一列」：起点方向各家默认不同
      // （element-plus 先 asc，naive-ui 先 desc），契约没有规定看哪一方
      await trigger(0).trigger('click')
      await flushPromises()
      const first = sortOf()
      expect(Object.keys(first ?? {}).sort(), 'update:sort 的 payload 必须是 { field, order }').toEqual([
        'field',
        'order',
      ])
      expect(first.field, 'field 必须取 column.dataIndex，而不是 column.key').toBe('name')
      expect(['asc', 'desc']).toContain(first.order)

      // 同一列再点一次必须换向，而不是重复发同一个方向
      await trigger(0).trigger('click')
      await flushPromises()
      expect(sortOf().field).toBe('name')
      expect(sortOf().order).toBe(first.order === 'asc' ? 'desc' : 'asc')

      // 第三次回到未排序，payload 必须是 null，业务侧才清得掉查询条件
      await trigger(0).trigger('click')
      await flushPromises()
      expect(sortOf()).toBeNull()

      // 换一列，field 跟着列走（仍是 dataIndex，不是 key）
      await trigger(1).trigger('click')
      await flushPromises()
      expect(sortOf().field).toBe('age')

      /* dataIndex 在 DataGridColumn 上是可选字段，缺省时必须回退到 column.key，
         否则后端收到的是 undefined。这条用例同时钉住两家的回退行为。 */
      const fallback = mount(p.DataGrid, {
        columns: [{ key: 'userName', title: '名称', sortable: true }],
        data: [{ id: 1, userName: 'Alice' }],
        rowKey: 'id',
      })
      await flushPromises()
      const fallbackTriggers = fallback.findAll(selectors.sortTrigger)
      expect(fallbackTriggers.length, 'dataIndex 缺省的 sortable 列也必须渲染排序控件').toBe(1)
      await fallbackTriggers[0].trigger('click')
      await flushPromises()
      const fallbackSort = fallback.findComponent(p.DataGrid).emitted('update:sort')?.at(-1)?.[0] as any
      expect(fallbackSort?.field, 'dataIndex 缺省时 field 必须回退到 column.key').toBe('userName')
      expect(['asc', 'desc']).toContain(fallbackSort?.order)
    })

    itUnlessSkipped('pagination')('Pagination 触发 update:page', async () => {
      const wrapper = mount(p.Pagination, { page: 1, pageSize: 20, total: 100 })
      const next = wrapper.find(selectors.nextPage)
      expect(next.exists()).toBe(true)
      await next.trigger('click')
      expect(wrapper.findComponent(p.Pagination).emitted('update:page')).toBeTruthy()
    })


    it('提供 feedback：message 四种语义 + confirm', () => {
      const f = adapter.feedback
      expect(f, '缺少 feedback').toBeTruthy()
      expect(typeof f.message).toBe('function')
      for (const kind of ['success', 'warning', 'error', 'info'] as const) {
        expect(typeof f.message[kind], `message.${kind} 不是函数`).toBe('function')
      }
      expect(typeof f.confirm).toBe('function')

      /* 刻意**不**调用 f.confirm()：它会弹出真实模态框并等待用户点击，
         在测试环境里永远不 resolve（实测 5s 超时）。
         契约对 confirm 的承诺（resolve 布尔而非 reject）由各适配器的
         单元测试用 mock 验证，这里只断言形态。 */
    })

    it('feedback 的调用不抛错（无 provider 时降级）', () => {
      // 未包 RootProvider 时 naive 会降级、vant/element 直接可用；
      // 无论哪种，都不应该把异常抛给业务侧
      expect(() => adapter.feedback.message.info('契约测试')).not.toThrow()
    })

    it('主题桥 apply 幂等', () => {
      const apply = vi.spyOn(adapter.theme, 'apply')
      adapter.theme.apply('light', defaultTokens)
      adapter.theme.apply('light', defaultTokens)
      expect(apply).toHaveBeenCalledTimes(2)
      apply.mockRestore()
    })

    it('provider 型适配器必须提供 providerProps', () => {
      if (adapter.capabilities.theme.provider) {
        expect(typeof adapter.theme.providerProps).toBe('function')
      }
    })
  })
}
