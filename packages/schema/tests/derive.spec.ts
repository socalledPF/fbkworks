import { describe, expect, expectTypeOf, it } from 'vitest'
import type { FieldMeta } from '../src'
import { defineFields, toColumns, toFormFields, toQueryFields } from '../src'

const ORDER_STATUS = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'shipped' },
]

/** Orders 页的三个字段：此前要在 FormField / QueryField / ProTableColumn 里各写一遍。 */
const orderFields = () =>
  defineFields([
    {
      name: 'status',
      label: '状态',
      type: 'select',
      options: ORDER_STATUS,
      query: { placeholder: '全部' },
      column: { width: 120, sortable: true },
      form: { required: true },
    },
    { name: 'amount', label: '金额', type: 'number' },
    { name: 'remark', label: '备注', type: 'textarea', views: ['form'] },
  ])

const names = (list: Record<string, unknown>[]) => list.map((item) => item.name)

describe('defineFields', () => {
  it('返回同一个数组引用（不是副本），只做类型收窄', () => {
    const fields: FieldMeta[] = [{ name: 'a', label: 'A', type: 'input' }]
    expect(defineFields(fields)).toBe(fields)
  })

  it('保留 type 的字面量类型（const 泛型），否则派生结果全是宽类型', () => {
    const fields = defineFields([{ name: 'status', label: '状态', type: 'select' }])
    expectTypeOf(fields[0].type).toEqualTypeOf<'select'>()
  })

  it('拒绝 UI 库命名的 type：三端中立，映射是适配层的事', () => {
    // 这条 @ts-expect-error 一旦「多余」（TS2578），说明 FieldType 被放宽成了 string
    // @ts-expect-error 'el-select' 不属于 FieldType
    defineFields([{ name: 'status', label: '状态', type: 'el-select' }])
  })
})

describe('份数：一份定义派生三份视图', () => {
  it('一份 3 字段定义 → 三个派生器各得 3 条', () => {
    const fields = defineFields([
      { name: 'a', label: 'A', type: 'input' },
      { name: 'b', label: 'B', type: 'number' },
      { name: 'c', label: 'C', type: 'date' },
    ])
    expect(toQueryFields(fields)).toHaveLength(3)
    expect(toColumns(fields)).toHaveLength(3)
    expect(toFormFields(fields)).toHaveLength(3)
    expect(names(toQueryFields(fields))).toEqual(['a', 'b', 'c'])
    expect(names(toColumns(fields))).toEqual(['a', 'b', 'c'])
    expect(names(toFormFields(fields))).toEqual(['a', 'b', 'c'])
  })

  it('同一份定义，三个派生器给出的视图配置各自独立', () => {
    const fields = orderFields()
    expect(toQueryFields(fields)[0]).toEqual({
      name: 'status',
      label: '状态',
      type: 'select',
      options: ORDER_STATUS,
      placeholder: '全部',
    })
    expect(toColumns(fields)[0]).toEqual({
      name: 'status',
      label: '状态',
      type: 'select',
      options: ORDER_STATUS,
      width: 120,
      sortable: true,
    })
    expect(toFormFields(fields)[0]).toEqual({
      name: 'status',
      label: '状态',
      type: 'select',
      options: ORDER_STATUS,
      required: true,
    })
  })
})

describe('views 过滤', () => {
  it("views: ['column'] 的字段只出现在 toColumns 里", () => {
    const fields = defineFields([
      { name: 'amount', label: '金额', type: 'number' },
      { name: 'createdAt', label: '创建时间', type: 'date', views: ['column'] },
    ])
    expect(names(toColumns(fields))).toEqual(['amount', 'createdAt'])
    expect(names(toQueryFields(fields))).toEqual(['amount'])
    expect(names(toFormFields(fields))).toEqual(['amount'])
  })

  /* 判别性用例：把「views 缺省」实现成 field.views ?? []（即把没写当成空数组）时，
     本条必然红：三个派生器都会返回空数组。实测注入该退化实现后，17 条里 10 条红。 */
  it('views 缺省 = 三个视图都出现（把缺省当成空数组时这条会红）', () => {
    const fields = defineFields([{ name: 'amount', label: '金额', type: 'number' }])
    expect(names(toQueryFields(fields))).toEqual(['amount'])
    expect(names(toColumns(fields))).toEqual(['amount'])
    expect(names(toFormFields(fields))).toEqual(['amount'])
  })

  /* 反方向的单边判别：把空数组当成「全部」时，本用例是**唯一**会红的一条
     （实测注入 field.views?.length 版本后，17 条里只有它红）。 */
  it('views: [] 是「一个视图都不要」，不是「全部」', () => {
    const fields = defineFields([
      { name: 'amount', label: '金额', type: 'number' },
      { name: 'secret', label: '内部字段', type: 'input', views: [] },
    ])
    expect(names(toQueryFields(fields))).toEqual(['amount'])
    expect(names(toColumns(fields))).toEqual(['amount'])
    expect(names(toFormFields(fields))).toEqual(['amount'])
  })

  it('views 本身不泄漏进派生结果', () => {
    const fields = orderFields()
    for (const view of [toQueryFields(fields), toColumns(fields), toFormFields(fields)]) {
      for (const item of view) expect(item).not.toHaveProperty('views')
    }
  })
})

describe('覆盖优先级：视图自己的键压过通用键', () => {
  it('form 里的同名键覆盖通用键', () => {
    const fields = defineFields([
      {
        name: 'status',
        label: '状态',
        type: 'select',
        options: ORDER_STATUS,
        form: { options: [{ label: '仅作表单用', value: 'form-only' }], required: true },
      },
    ])
    expect(toFormFields(fields)[0]).toEqual({
      name: 'status',
      label: '状态',
      type: 'select',
      options: [{ label: '仅作表单用', value: 'form-only' }],
      required: true,
    })
    // 覆盖只发生在 form 那份里，别的视图仍是通用值
    expect(toColumns(fields)[0].options).toBe(ORDER_STATUS)
    expect(toQueryFields(fields)[0].options).toBe(ORDER_STATUS)
  })

  it('视图能覆盖基础键 label，且不波及别的视图', () => {
    const fields = defineFields([
      { name: 'amount', label: '金额', type: 'number', column: { label: '金额（元）' } },
    ])
    expect(toColumns(fields)[0].label).toBe('金额（元）')
    expect(toQueryFields(fields)[0].label).toBe('金额')
    expect(toFormFields(fields)[0].label).toBe('金额')
  })
})

describe('不可变性：派生结果不共享引用', () => {
  it('改派生结果不影响原定义', () => {
    const fields = defineFields([
      {
        name: 'status',
        label: '状态',
        type: 'select',
        options: ORDER_STATUS,
        form: { required: true },
      },
    ])
    const before = JSON.parse(JSON.stringify(fields))

    const formFields = toFormFields(fields)
    formFields[0].label = '被改过的标签'
    formFields[0].required = false
    formFields.push({ name: 'injected', label: '注入', type: 'input' })

    expect(fields).toEqual(before)
    expect(fields).toHaveLength(1)
    expect(fields[0].label).toBe('状态')
    expect(fields[0].form).toEqual({ required: true })
  })

  it('每次调用都返回新对象（三条派生结果互不共享）', () => {
    const fields = orderFields()
    const a = toColumns(fields)
    const b = toColumns(fields)
    expect(a[0]).not.toBe(b[0])
    expect(a[0]).not.toBe(fields[0])
    a[0].width = 999
    expect(b[0].width).toBe(120)
  })

  it('改一个视图的派生结果不影响另一个视图', () => {
    const fields = orderFields()
    const query = toQueryFields(fields)
    const columns = toColumns(fields)
    query[0].placeholder = '改过'
    expect(columns[0]).not.toHaveProperty('placeholder')
  })

  /* 刻意划边界：顶层键是新对象，options 这类嵌套值按引用共享。
     深拷贝会换掉 options 数组里每个选项对象的身份，而表单/表格库普遍按引用做
     选中匹配（v-model 回填时会「选不中」）。这条用例把约定写死，改实现前会先撞到它。 */
  it('options 按引用共享（刻意如此，不是遗漏）', () => {
    const fields = orderFields()
    expect(toColumns(fields)[0].options).toBe(ORDER_STATUS)
    expect(toFormFields(fields)[0].options).toBe(ORDER_STATUS)
  })
})

describe('type 三端约定', () => {
  it('六个 FieldType 原样透传，不映射成任何 UI 库的命名', () => {
    const types = ['input', 'textarea', 'number', 'select', 'date', 'switch'] as const
    const fields = defineFields(
      types.map((type, index) => ({ name: `f${index}`, label: `F${index}`, type })),
    )
    expect(toFormFields(fields).map((item) => item.type)).toEqual([...types])
    expect(toColumns(fields).map((item) => item.type)).toEqual([...types])
    expect(toQueryFields(fields).map((item) => item.type)).toEqual([...types])
  })

  it('空定义派生空数组（不是 undefined）', () => {
    const fields = defineFields([])
    expect(toQueryFields(fields)).toEqual([])
    expect(toColumns(fields)).toEqual([])
    expect(toFormFields(fields)).toEqual([])
  })
})
