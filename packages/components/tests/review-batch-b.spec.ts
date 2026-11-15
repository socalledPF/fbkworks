import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkFormModal } from '../src/form-modal'
import { FbkDetailDrawer } from '../src/detail-drawer'
import { FbkDetailPage } from '../src/detail-page'
import { FbkProTable } from '../src/pro-table'
import { FbkCrudPage } from '../src/crud-page'

/**
 * 本轮评审修掉的行为。每条都对应一个「以前静默失效/抛错」的场景，
 * 所以断言的都是**可观察的结果**，不是内部状态。
 */

const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
const rows = [{ id: 1, name: 'Alice' }]

describe('FormModal：命令式打开的值优先于 initialValues', () => {
  it('openEdit(rowB) 回填的是 rowB，而不是还停在 rowA 的 initialValues', async () => {
    /* 以前：openEdit 先写 values，紧接着 show 变 true 触发 syncOnOpen，
       被 props.initialValues（还停在 A）覆盖 —— 用户在编辑 B、表单里是 A。 */
    const schema = { fields: [{ name: 'name', label: '名称', type: 'input' as const }] }
    const initialValues = ref<Record<string, any>>({ name: '甲公司' })
    const modalRef = ref<any>(null)
    const show = ref(false)
    const Host = defineComponent({
      setup: () => () =>
        h(FbkFormModal as any, {
          ref: modalRef,
          schema,
          show: show.value,
          initialValues: initialValues.value,
          'onUpdate:show': (v: boolean) => (show.value = v),
        }),
    })
    const wrapper = mountWithAdapter(Host)
    await flushPromises()

    modalRef.value.openEdit({ name: '乙公司' })
    await nextTick()
    show.value = true
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    expect((modalRef.value as any).getValues()).toMatchObject({ name: '乙公司' })
    wrapper.unmount()
  })
})

describe('DetailDrawer：调用方自己改 show 也要发 close', () => {
  it('show: true → false 时 emit 一次 close（且只一次）', async () => {
    const show = ref(true)
    const onClose = vi.fn()
    const Host = defineComponent({
      setup: () => () =>
        h(FbkDetailDrawer as any, {
          show: show.value,
          request: async () => ({ id: 1, name: 'A' }),
          'onUpdate:show': (v: boolean) => (show.value = v),
          onClose,
        }),
    })
    const wrapper = mountWithAdapter(Host)
    await flushPromises()

    show.value = false
    await flushPromises()
    expect(onClose, '调用方自改 show 时没有发 close').toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('ProTable：immediate=false 时不发首屏请求', () => {
  it('挂载后一次都不请求；调 reload() 才请求', async () => {
    const request = vi.fn().mockResolvedValue({ list: rows, total: 1 })
    const wrapper = mountWithAdapter(FbkProTable, {
      props: { columns, request, rowKey: 'id', immediate: false },
    })
    await flushPromises()
    expect(request, 'immediate=false 仍然发了首屏请求').not.toHaveBeenCalled()

    await (wrapper.findComponent(FbkProTable).vm as any).reload()
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('DetailPage：immediate=false 不该判成 404', () => {
  it('一次都没请求时不显示「记录不存在」', async () => {
    const wrapper = mountWithAdapter(FbkDetailPage, {
      props: { request: async () => ({ id: 1 }), immediate: false },
    })
    await flushPromises()
    const html = wrapper.html()
    expect(html, '请求都没发就判 404').not.toContain('不存在')
    wrapper.unmount()
  })
})

describe('CrudPage：转发 QueryForm 的 field-<name> 插槽', () => {
  it('写了 #field-status 就能真的接管那个筛选项', async () => {
    const Host = defineComponent({
      setup: (_, { slots }) => () =>
        h(FbkCrudPage as any, {
          columns,
          request: async () => ({ list: rows, total: 1 }),
          rowKey: 'id',
          queryFields: [{ name: 'status', label: '状态', type: 'input' }],
        }, {
          ...slots,
          'field-status': () => h('div', { 'data-test': 'custom-field' }, '自定义控件'),
        }),
    })
    const wrapper = mountWithAdapter(Host)
    await flushPromises()
    expect(wrapper.find('[data-test="custom-field"]').exists(), 'field-* 插槽被白名单吞掉了').toBe(true)
    wrapper.unmount()
  })
})
