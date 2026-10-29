import type { FbkRule } from '@fbkworks/adapter-core'
import type { QueryField } from '../query-form/types'

export type FormFieldType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'date-range'
  | 'time'
  | 'upload'
  | 'rate'
  | 'slider'
  | 'custom'

export interface FormField<V = any> extends Omit<QueryField<V>, 'type'> {
  type: FormFieldType
  required?: boolean
  disabled?: boolean | ((model: Record<string, any>) => boolean)
  help?: string
  /** 依赖字段：值变化时重新计算 disabled/hidden */
  dependencies?: string[]
}

export interface FormGroup {
  title?: string
  fields: string[]
}

export interface FormSchema<T extends Record<string, any> = Record<string, any>> {
  fields: FormField<keyof T extends never ? any : T[keyof T]>[]
  groups?: FormGroup[]
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number }
  labelWidth?: string | number
  labelPosition?: 'left' | 'right' | 'top'
  rules?: Record<string, FbkRule[]>
}

export interface FormGeneratorProps<T extends Record<string, any> = Record<string, any>> {
  schema: FormSchema<T>
  modelValue?: Partial<T>
  defaultValues?: Partial<T>
  mode?: 'create' | 'edit' | 'view'
  disabled?: boolean
  loading?: boolean
  showActions?: boolean
  submitText?: string
  resetText?: string
  uiProps?: Record<string, any>
}

export interface FormGeneratorExpose {
  validate: () => Promise<true>
  validateField: (prop: string | string[]) => Promise<true>
  resetFields: () => void
  getValues: () => Record<string, any>
  setValues: (values: Record<string, any>) => void
  submit: () => void
}
