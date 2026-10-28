import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMockAdapter, mountWithAdapter } from '@fbk/test-utils'
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

  /**
   * 一次重置只能发一个请求。
   *
   * 表单重置会把 params 换成默认值，useTableRequest 的 watch 已经负责
   * 「回到第 1 页 + 重新查询」；reset() 里再 await refresh() 就多打一发，
   * 两个请求必有一个被 requestId 丢弃（结果对，但白花一次带宽）。
   */
  it('点一次重置只发一个请求，且是第 1 页 + 新条件', async () => {
    // 按条件给出不同数据：重置后表格里必须真的换成「无筛选」那份
    const request = vi
      .fn()
      .mockImplementation((p: { params: Record<string, any> }) =>
        Promise.resolve(
          p.params.keyword === 'abc'
            ? { list: [{ id: 9, name: 'filtered' }], total: 1 }
            : { list: rows, total: 1 },
        ),
      )
    const wrapper = mountCrud({ request })
    await flushPromises()

    await wrapper.findAll('input[data-fbk-part="input"]')[0].setValue('abc')
    await wrapper.findAll('button').find((b) => b.text() === '查询')!.trigger('click')
    await flushPromises()

    // 先翻到第 2 页：重置必须把页码也拉回 1
    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    request.mockClear()
    await (wrapper.findComponent(FbkCrudPage).vm as any).reset()

    // reset() 返回时那一次查询已经发出，否则 await 之后再断言就测不到它
    expect(request.mock.calls.length, '一次重置发了多个请求').toBe(1)
    await flushPromises()
    expect(request.mock.calls.length, '重置之后又补发了一个请求').toBe(1)
    const sent = request.mock.calls[0][0] as { page: number; params: Record<string, any> }
    expect(sent.page, '重置后没回到第 1 页').toBe(1)
    expect(sent.params.keyword, '重置后还带着旧条件').not.toBe('abc')
    expect((wrapper.findComponent(FbkCrudPage).vm as any).getData(), '表格里还是筛选后的旧数据').toEqual(rows)
  })

  it('没有查询字段时不渲染查询区', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: { columns, request: vi.fn().mockResolvedValue({ list: rows, total: 1 }), rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.find('.fbk-query-form').exists()).toBe(false)
    expect(wrapper.find('.fbk-pro-table').exists()).toBe(true)
  })

  it('没有查询区时 reset 仍然重新查询 —— params 不变就没有 watch 兜底', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: { columns, request, rowKey: 'id' },
    })
    await flushPromises()

    request.mockClear()
    await (wrapper.findComponent(FbkCrudPage).vm as any).reset()
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
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

/**
 * 事件透出。
 *
 * CrudPage 此前没有 defineEmits —— <FbkCrudPage @error="..."> 的 onError 留在
 * attrs 里，被 v-bind="attrs" 挂成根 div 上的**原生** error 监听器，
 * 表格请求失败时父组件一次也收不到。补 emits 必须显式转发，
 * 并且 onError 不再落到根元素（这是修复，不是回归，下面钉住）。
 */
describe('CrudPage 事件透出', () => {
  /** 经过父级渲染才能测 emit 链路：直接 mount 时 attrs 与监听器没有父组件可依附 */
  const hostWith = (props: Record<string, any>, listeners: Record<string, any>) =>
    mountWithAdapter(
      defineComponent({
        name: 'FbkCrudPageHost',
        setup: () => () => h(FbkCrudPage as any, { ...props, ...listeners }),
      }),
      {},
    )

  const okRequest = () => vi.fn().mockResolvedValue({ list: rows, total: 1 })

  it('表格请求失败时父组件收到 @error，且它不再是根元素上的原生监听器', async () => {
    const error = new Error('boom')
    const onError = vi.fn()
    const wrapper = hostWith(
      { columns, request: vi.fn().mockRejectedValue(error), rowKey: 'id' },
      { onError },
    )
    await flushPromises()

    expect(onError, 'CrudPage 没有把表格的 error 透出').toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe(error)

    // 修复前 onError 挂在根 div 上，一次原生 error 事件就能触发它
    wrapper.find('.fbk-crud-page').element.dispatchEvent(new Event('error'))
    expect(onError, '@error 仍被当作根元素的原生监听器').toHaveBeenCalledTimes(1)
  })

  it('请求失败时页面显示可识别的错误态，不是「暂无数据」', async () => {
    const wrapper = mountCrud({ request: vi.fn().mockRejectedValue(new Error('boom')) })
    await flushPromises()

    expect(wrapper.find('[data-fbk-part="empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('加载失败')
  })

  it('error 插槽透传给表格，可定制错误态', async () => {
    const wrapper = mountWithAdapter(FbkCrudPage, {
      props: { columns, request: vi.fn().mockRejectedValue(new Error('boom')), rowKey: 'id' },
      slots: {
        error: (slotProps: any) =>
          h('div', { 'data-test': 'crud-error' }, (slotProps.error as Error).message),
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-test="crud-error"]').text()).toContain('boom')
    expect(wrapper.find('.fbk-result').exists()).toBe(false)
  })

  it('load 透出，参数与表格一致', async () => {
    const onLoad = vi.fn()
    hostWith({ columns, request: okRequest(), rowKey: 'id' }, { onLoad })
    await flushPromises()

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad.mock.calls[0][0]).toEqual({ list: rows, total: 1 })
    expect(onLoad.mock.calls[0][1]).toEqual(expect.objectContaining({ page: 1, params: {} }))
  })

  it('row-click 透出', async () => {
    const onRowClick = vi.fn()
    const wrapper = hostWith({ columns, request: okRequest(), rowKey: 'id' }, { onRowClick })
    await flushPromises()

    await wrapper.find('[data-fbk-part="grid-row"]').trigger('click')
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toEqual(rows[0])
  })

  it('update:pageSize 透出 —— kebab 事件名必须真的接上', async () => {
    const adapter = createMockAdapter()
    // mock 的分页没有改页大小的控件，这里换一个只会 emit update:pageSize 的
    ;(adapter.primitives as any).Pagination = defineComponent({
      name: 'PageSizePagination',
      props: { page: Number, pageSize: Number, total: Number },
      emits: ['update:page', 'update:pageSize'],
      setup(_props, { emit }) {
        return () =>
          h('button', { 'data-test': 'set-size', onClick: () => emit('update:pageSize', 50) }, 'size')
      },
    })

    const onPageSize = vi.fn()
    const wrapper = mountWithAdapter(
      defineComponent({
        name: 'FbkCrudPageSizeHost',
        setup: () => () =>
          h(FbkCrudPage as any, {
            columns,
            request: okRequest(),
            rowKey: 'id',
            'onUpdate:pageSize': onPageSize,
          }),
      }),
      { adapter },
    )
    await flushPromises()

    await wrapper.find('[data-test="set-size"]').trigger('click')
    await flushPromises()
    expect(onPageSize).toHaveBeenCalledWith(50)
  })

  it('update:page 透出', async () => {
    const onPage = vi.fn()
    const wrapper = hostWith(
      { columns, request: okRequest(), rowKey: 'id' },
      { 'onUpdate:page': onPage },
    )
    await flushPromises()

    await wrapper.find('[data-fbk-part="next"]').trigger('click')
    await flushPromises()
    expect(onPage).toHaveBeenCalledWith(2)
  })
})
