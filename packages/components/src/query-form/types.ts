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

export interface QueryField<V = any> {
  name: string
  label: string
  type: QueryFieldType
  placeholder?: string
  options?: SelectOption[]
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
