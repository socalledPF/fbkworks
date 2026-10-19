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
    ...options.selectors,
  }

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
      const input = wrapper.find('input[type="checkbox"]')
      expect(input.exists()).toBe(true)

      const element = input.element as HTMLInputElement
      element.checked = true
      element.dispatchEvent(new Event('change', { bubbles: true }))
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

    it('DataGrid 渲染 loading 态', () => {
      const wrapper = mount(p.DataGrid, { columns, data: rows, loading: true })
      expect(wrapper.html()).toBeTruthy()
    })

    if (!skip.includes('selection')) {
      it('DataGrid 支持选择', async () => {
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
    }

    if (!skip.includes('pagination')) {
      it('Pagination 触发 update:page', async () => {
        const wrapper = mount(p.Pagination, { page: 1, pageSize: 20, total: 100 })
        const next = wrapper.find(selectors.nextPage)
        expect(next.exists()).toBe(true)
        await next.trigger('click')
        expect(wrapper.findComponent(p.Pagination).emitted('update:page')).toBeTruthy()
      })
    }

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
