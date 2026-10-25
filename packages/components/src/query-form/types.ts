import type { VNodeChild } from 'vue'
import type { FbkRule, SelectOption } from '@fbk/adapter-core'

export type QueryFieldType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'date-range'
  | 'custom'

/**
 * 选项可以静态给数组，也可以由当前表单值动态算。
 *
 * 动态形式解决「联动」：选了省份后城市选项变化。
 * 之前只能让业务方把 options 放进 ref 再手动改，写法绕且容易忘记清空旧的选中值。
 */
export type SelectOptionsResolver = (
  values: Record<string, any>,
) => SelectOption[]

export interface QueryField<V = any> {
  name: string
  label: string
  type: QueryFieldType
  placeholder?: string
  options?: SelectOption[] | SelectOptionsResolver
  defaultValue?: V
  span?: number
  hidden?: boolean | ((values: Record<string, any>) => boolean)
  rules?: FbkRule[]
  uiProps?: Record<string, any>
  render?: (ctx: {
    value: V
    values: Record<string, any>
    setValue: (value: V) => void
  }) => VNodeChild
}

export interface QueryFormProps {
  fields: QueryField[]
  modelValue?: Record<string, any>
  defaultValues?: Record<string, any>
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  collapsible?: boolean
  defaultCollapsed?: boolean
  visibleCount?: number
  submitText?: string
  resetText?: string
  loading?: boolean
  labelWidth?: string | number
  uiProps?: { form?: Record<string, any>; actions?: Record<string, any> }
}

export interface QueryFormExpose {
  submit: () => void
  reset: () => void
  validate: () => Promise<true>
  getValues: () => Record<string, any>
  setValues: (values: Record<string, any>) => void
}
