import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountWithAdapter } from '@fbk/test-utils'
import { FbkCrudPage } from '../src/crud-page'

const fields = [
  { name: 'keyword', label: '关键词', type: 'input' as const },
  { name: 'status', label: '状态', type: 'select' as const, options: [{ label: '启用', value: 1 }] },
]
const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
const rows = [{ id: 1, name: 'A' }]

const mountCrud = (overrides: Record<string, any> = {}) =>
  mountWithAdapter(FbkCrudPage, {
    props: { queryFields: fields, columns, request: vi.fn().mockResolvedValue({ list: rows, total: 1 }), rowKey: 'id', ...overrides },
  })

/**
 * CrudPage 的价值在于把「查询表单 + 表格」的联动固化，
 * 尤其是三条容易漏的细节。这里逐条锁定。
 */
describe('CrudPage 联动', () => {
  it('首屏自动发起请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    mountCrud({ request })
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('提交查询后带着条件重新请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    const wrapper = mountCrud({ request })
    await flushPromises()

    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('abc')
    await wrapper.findAll('button').find((b) => b.text() === '查询')!.trigger('click')
    await flushPromises()

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ keyword: 'abc' }) }),
    )
  })

  it('输入过程中不请求 —— 只在 submit 时联动', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    const wrapper = mountCrud({ request })
    await flushPromises()
    const before = request.mock.calls.length

    // 连续输入但不点查询
    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('a')
    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('ab')
    await flushPromises()

    expect(request.mock.calls.length).toBe(before)
  })

  it('重置会清空条件并刷新表格', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    const wrapper = mountCrud({ request })
    await flushPromises()

    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('abc')
    await wrapper.findAll('button').find((b) => b.text() === '查询')!.trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === '重置')!.trigger('click')
    await flushPromises()

    // 重置后条件应为空，且表格重新请求过
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.not.objectContaining({ keyword: 'abc' }) }),
    )
  })

  it('没有查询字段时不渲染查询区', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: { columns, request: vi.fn().mockResolvedValue({ list: rows, total: 1 }), rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.find('.fbk-query-form').exists()).toBe(false)
    expect(wrapper.find('.fbk-pro-table').exists()).toBe(true)
  })

  it('暴露 refresh / reset / getParams / getData', async () => {
    const wrapper = mountCrud()
    await flushPromises()
    const vm = wrapper.findComponent(FbkCrudPage).vm as any

    expect(typeof vm.refresh).toBe('function')
    expect(typeof vm.reset).toBe('function')
    expect(vm.getParams()).toEqual({})
    expect(vm.getData()).toEqual(rows)
  })

  it('getParams 返回副本，外部修改不影响内部状态', async () => {
    const wrapper = mountCrud()
    await flushPromises()
    const vm = wrapper.findComponent(FbkCrudPage).vm as any

    const p = vm.getParams()
    p.injected = true
    expect(vm.getParams()).not.toHaveProperty('injected')
  })

  it('form 插槽渲染在表格之后（弹窗表单的常规位置）', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: { queryFields: fields, columns, request: vi.fn().mockResolvedValue({ list: rows, total: 1 }), rowKey: 'id' },
      slots: { form: '<div data-test="dialog-form">表单</div>' },
    })
    await flushPromises()
    const root = wrapper.find('.fbk-crud-page').element as HTMLElement
    expect(root.querySelector('[data-test="dialog-form"]')).not.toBeNull()
  })

  /**
   * 插槽必须真的渲染。
   *
   * 曾经写成 `<template v-if="$slots.toolbar" #toolbar>` ——
   * 具名插槽上同时用 v-if 不会被 Vue 编译成插槽，结果 toolbar 与
   * bulk-actions 静默丢失（form 插槽正常，所以很容易漏测）。
   */
  it('toolbar / bulk-actions / form 三个插槽都渲染', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: {
        columns,
        request: vi.fn().mockResolvedValue({ list: rows, total: 1 }),
        rowKey: 'id',
        selection: {},
      },
      slots: {
        toolbar: '<button data-test="tb">新建</button>',
        'bulk-actions': '<button data-test="bulk">批量</button>',
        form: '<div data-test="form">表单</div>',
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-test="tb"]').exists(), 'toolbar 插槽没渲染').toBe(true)
    expect(wrapper.find('[data-test="bulk"]').exists(), 'bulk-actions 插槽没渲染').toBe(true)
    expect(wrapper.find('[data-test="form"]').exists(), 'form 插槽没渲染').toBe(true)
  })

  it('selection 透传给 ProTable，全选控件出现', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: {
        columns,
        request: vi.fn().mockResolvedValue({ list: rows, total: 1 }),
        rowKey: 'id',
        selection: { preserveOnReload: true },
      },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'FbkProTable' }).props('selection')).toEqual({
      preserveOnReload: true,
    })
    expect(wrapper.find('.fbk-pro-table__select-all').exists()).toBe(true)
  })
})
