import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkProTable } from '../src/pro-table'
import { resolveColumnRenderer } from '../src/pro-table/value-renderer'

const Tag = { name: 'Tag', render: () => null }

describe('resolveColumnRenderer 的 locale', () => {
  const render = (column: ReturnType<typeof resolveColumnRenderer>, value: unknown) =>
    String(
      column.render?.({ row: {}, index: 0, column, value } as any) ?? '',
    )

  it('不传 locale 时保持 zh-CN 行为', () => {
    const column = resolveColumnRenderer(
      { key: 'a', title: 'A', valueType: 'money' },
      { Tag },
    )
    expect(render(column, 1234.5)).toBe('1,234.50')
  })

  it('locale 影响数字分组与小数点', () => {
    const column = resolveColumnRenderer(
      { key: 'a', title: 'A', valueType: 'money' },
      { Tag, locale: 'de-DE' },
    )
    expect(render(column, 1234.5)).toBe('1.234,50')
  })

  it('locale 影响 date 与 datetime', () => {
    const date = new Date(2026, 8, 1, 10, 30)
    const column = resolveColumnRenderer(
      { key: 'd', title: 'D', valueType: 'datetime' },
      { Tag, locale: 'en-US' },
    )
    const text = render(column, date)
    // en-US 的日期不含短横线分隔，能明确区分是否走了 locale 分支
    expect(text).not.toBe('2026-09-01 10:30')
    expect(text).toContain('2026')
  })

  it('zh-CN 的 datetime 仍是短横线格式（零视觉回归）', () => {
    const date = new Date(2026, 8, 1, 10, 30)
    const column = resolveColumnRenderer(
      { key: 'd', title: 'D', valueType: 'datetime' },
      { Tag, locale: 'zh-CN' },
    )
    expect(render(column, date)).toBe('2026-09-01 10:30')
  })
})

describe('ProTable 从注入上下文取 locale', () => {
  const columns = [
    { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money' as const },
  ]
  const data = [{ id: 1, amount: 1234.5 }]

  it('locale=en-US 时金额按 en-US 渲染', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      locale: 'en-US',
      props: { columns, data, rowKey: 'id' },
    })
    await flushPromises()
    // en-US 与 zh-CN 在这个值上分组一致，区别在德国这种才明显；
    // 这里断言单元格确实渲染出金额，且走的是 locale 参数化路径
    expect(wrapper.text()).toContain('1,234.50')
  })

  it('locale=de-DE 时金额用德式分隔符', async () => {
    const wrapper = mountWithAdapter(FbkProTable, {
      locale: 'de-DE',
      props: { columns, data, rowKey: 'id' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('1.234,50')
  })
})
