/**
 * 字段元数据的单一来源：**一份定义，派生 query / column / form 三份视图**。
 *
 * 为什么要有这个包：同一张业务表，此前要在 `FormField` / `QueryField` / `ProTableColumn`
 * 三套类型里各写一遍同一个字段。写三遍的代价不是打字，是**漂移** —— 改了标签忘了改列头、
 * 加了选项忘了加查询下拉，两处都合法、两处都编译通过、两处都不会红。
 *
 * 三条边界（也是本包的全部约定）：
 *   1. 纯函数、零依赖、不引 vue：入参和返回值都是普通对象，node 里能直接跑；
 *   2. `type` 是**三端中立**的字面量（`'select'` 而不是 `'el-select'`），映射到具体 UI 库
 *      是适配层的事 —— 本包一旦认识某个 UI 库，三端差异就回来了；
 *   3. 派生结果是**新对象**，调用方随便改都不会污染原定义。
 */

/** 三端中立的控件类型。非 UI 库命名：适配层负责把它映射成各自的组件。 */
export type FieldType = 'input' | 'textarea' | 'number' | 'select' | 'date' | 'switch'

/** 一个字段可以出现的位置。 */
export type FieldView = 'query' | 'column' | 'form'

export interface FieldMeta {
  name: string
  label: string
  type: FieldType
  /** 出现在哪些视图里。**缺省 = 三个视图都出现**（不是「都不出现」）。 */
  views?: FieldView[]
  /** 通用选项（下拉/单选等），原样带到三份视图里。 */
  options?: unknown
  /** 三个视图各自的附加配置，派生时原样合并。 */
  query?: Record<string, unknown>
  column?: Record<string, unknown>
  form?: Record<string, unknown>
}

/**
 * 声明一份字段定义。
 *
 * 返回值就是入参本身（同一个数组引用），只做**类型**收窄：`const` 泛型参数让
 * `type: 'select'` 保留字面量类型，而不是退化成 `FieldType`。
 */
export function defineFields<const T extends readonly FieldMeta[]>(fields: T): T {
  return fields
}

/**
 * 按视图派生。
 *
 * 缺省（`undefined`）必须走「全部出现」这一支 —— **不能用 `field.views ?? []` 表达缺省**：
 * 那把「没写」翻译成了「一个都不要」，而这两件事在业务上正好相反。
 */
function derive(fields: readonly FieldMeta[], view: FieldView): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const field of fields) {
    // 只有**显式给出**的 views 才做过滤；显式空数组 = 一个视图都不要。
    if (field.views !== undefined && !field.views.includes(view)) continue
    // views 是「定义」自己的键，三份视图配置也不进通用部分（下面按视图各自合并）
    const { views: _views, query: _query, column: _column, form: _form, ...common } = field
    // 视图自己的键覆盖通用键；options 之类的通用键三份视图都带上
    out.push({ ...common, ...field[view] })
  }
  return out
}

/** 派生成 QueryForm 的 `fields`。 */
export function toQueryFields(fields: readonly FieldMeta[]): Record<string, unknown>[] {
  return derive(fields, 'query')
}

/** 派生成 ProTable（及三端表格）的 `columns`。 */
export function toColumns(fields: readonly FieldMeta[]): Record<string, unknown>[] {
  return derive(fields, 'column')
}

/** 派生成 FormGenerator 的 `schema.fields`。 */
export function toFormFields(fields: readonly FieldMeta[]): Record<string, unknown>[] {
  return derive(fields, 'form')
}
