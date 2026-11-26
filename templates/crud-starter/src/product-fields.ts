/**
 * 字段定义：**一份定义，派生查询 / 表格 / 表单三份视图**。
 *
 * 这是模板要演示的核心 —— 也是接入时最省时间的一步。
 * 以前同一个字段要在 QueryField / ProTableColumn / FormField 三套类型里各写一遍，
 * 写三遍的代价不是打字，是**漂移**：改了标签忘了改列头、加了选项忘了加查询下拉，
 * 两处都合法、两处都编译通过、两处都不会红。
 *
 * 现在：只在这里加一行，三个视图（以及"这个字段出现在哪些视图"）一起变。
 *
 * 接自己的后端时，这个文件是第 2 处要替换的地方 —— 换掉字段清单即可，
 * 下面的三个导出与页面代码都不用动。
 */

import { defineFields, toColumns, toFormFields, toQueryFields } from '@fbkworks/schema'
import type { FieldMeta } from '@fbkworks/schema'
import type { ProTableColumn } from '@fbkworks/components/pro-table'
import type { QueryField } from '@fbkworks/components/query-form'
import type { FormField } from '@fbkworks/components/form-generator'
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_STATUS_ENUM,
  PRODUCT_STATUS_OPTIONS,
  type ProductRow,
} from './product-api'

export const productFields = defineFields([
  /* keyword 不是数据字段，只用来收集查询词 —— views 只写 query 就够了，
     不用在表格/表单里写「排除这一项」。 */
  {
    name: 'keyword',
    label: '关键词',
    type: 'input',
    views: ['query'],
    query: { placeholder: 'SKU / 商品名' },
  },
  {
    name: 'sku',
    label: 'SKU',
    type: 'input',
    views: ['column'],
    column: { width: 130 },
  },
  {
    name: 'name',
    label: '商品名',
    type: 'input',
    column: { minWidth: 180 },
    form: { required: true, placeholder: '如 无线耳机 Pro' },
  },
  {
    name: 'category',
    label: '分类',
    type: 'select',
    options: PRODUCT_CATEGORY_OPTIONS,
    column: { width: 100, valueType: 'tag' },
    form: { required: true },
  },
  {
    name: 'price',
    label: '价格',
    type: 'number',
    /* 价格/库存只在表格与表单里：查询区只留真正会用来筛的 4 个条件。
       想加回来，把这行删掉即可 —— 不用去改查询表单。 */
    views: ['column', 'form'],
    column: { width: 120, align: 'right', valueType: 'money', sortable: true },
    form: { required: true },
  },
  {
    name: 'stock',
    label: '库存',
    type: 'number',
    views: ['column', 'form'],
    column: { width: 100, align: 'right', sortable: true },
    form: { required: true },
  },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: PRODUCT_STATUS_OPTIONS,
    query: { placeholder: '全部' },
    column: { width: 110, valueType: 'enum', valueEnum: PRODUCT_STATUS_ENUM },
    form: { required: true },
  },
  {
    name: 'createdAt',
    label: '上架时间',
    type: 'date',
    views: ['column'],
    column: { width: 170, valueType: 'datetime', sortable: true },
  },
  /* 只出现在表单里：新增时填备注，列表和查询都不该有它 */
  {
    name: 'remark',
    label: '备注',
    type: 'textarea',
    views: ['form'],
    form: { placeholder: '可选' },
  },
] satisfies readonly FieldMeta[])

/* ---------------------------------------------------------------------------
   派生。三个派生器产出的都是**普通对象**（@fbkworks/schema 零依赖、不认 vue），
   而三个组件各自要求自己的字段类型 —— 下面的 cast 就是这条缝，全局只有这三行。
   加字段时不用碰它们。
   --------------------------------------------------------------------------- */

/** → QueryForm / CrudPage 的 queryFields */
export const queryFields = toQueryFields(productFields) as unknown as QueryField[]

/** → FormGenerator / FormModal 的 schema.fields */
export const formFields = toFormFields(productFields) as unknown as FormField[]

/**
 * → ProTable / CrudPage 的 columns。
 *
 * 这一份比另外两份多一步映射：schema 的键是 name / label（三端中立，不认识任何表格库），
 * 表格契约要的是 key / title / dataIndex。映射写在这里一次，不写在每个字段上 ——
 * 否则「一份定义」就退化成「一份定义 + 每个字段抄三个键」。
 */
export function toTableColumns(): ProTableColumn<ProductRow>[] {
  return toColumns(productFields).map(({ name, label, ...rest }) => {
    // type 是控件类型，表格不需要它（表格只认 valueType / render）
    const { type: _type, ...columnRest } = rest
    return {
      ...columnRest,
      key: String(name),
      title: String(label),
      dataIndex: String(name),
    } as ProTableColumn<ProductRow>
  })
}
