export type Size = 'sm' | 'md' | 'lg'

export type Status = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export type ButtonVariant = 'primary' | 'default' | 'dashed' | 'text' | 'link'

export interface ButtonProps {
  variant?: ButtonVariant
  status?: Status
  size?: Size
  disabled?: boolean
  loading?: boolean
  block?: boolean
  nativeType?: 'button' | 'submit' | 'reset'
}

export interface InputProps {
  modelValue?: string | number
  type?: 'text' | 'textarea' | 'password' | 'number' | 'email' | 'tel'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  rows?: number
  size?: Size
}

export interface SelectOption<V = string | number> {
  label: string
  value: V
  disabled?: boolean
}

export interface SelectProps<V = string | number> {
  modelValue?: V | V[] | null
  options: SelectOption<V>[]
  multiple?: boolean
  filterable?: boolean
  clearable?: boolean
  placeholder?: string
  /** 移动端 picker 的标题 */
  title?: string
  size?: Size
  disabled?: boolean
  loading?: boolean
}

export interface TagProps {
  status?: Status
  size?: Size
  closable?: boolean
  bordered?: boolean
}

export interface CheckboxProps {
  /** 单选布尔值是该原语的主要形态 */
  modelValue?: boolean
  /** 开关旁边的文案 */
  label?: string
  disabled?: boolean
  size?: Size
}

export interface CheckboxEmits {
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}

export interface EmptyProps {
  description?: string
}

/**
 * 日期/时间选择。
 *
 * 值统一用字符串：`YYYY-MM-DD`（date）/ `YYYY-MM-DD HH:mm:ss`（datetime）/
 * `HH:mm:ss`（time）。不传 Date 对象 —— 业务侧最常见的来源是后端 JSON，
 * 来回转换只会引入时区问题。适配器负责与各 UI 库的 Date 对象互转。
 *
 * 区间模式（range）下 modelValue 是长度为 2 的数组，空值用 null。
 */
export type DatePickerType = 'date' | 'datetime' | 'time' | 'daterange' | 'datetimerange'

export interface DatePickerProps {
  modelValue?: string | string[] | null
  type?: DatePickerType
  placeholder?: string | [string, string]
  disabled?: boolean
  clearable?: boolean
  size?: Size
  /** 透传给 UI 库的额外属性（如 disabledDate） */
  uiProps?: Record<string, any>
}

export interface RadioOption<V = string | number> {
  label: string
  value: V
  disabled?: boolean
}

export interface RadioProps<V = string | number> {
  modelValue?: V | null
  options: RadioOption<V>[]
  disabled?: boolean
  size?: Size
}

export interface SpinProps {
  loading?: boolean
  size?: Size
  description?: string
}

export interface DialogProps {
  modelValue?: boolean
  title?: string
  width?: string | number
  /** 移动端是否使用底部弹出 */
  placement?: 'center' | 'bottom'
  closeOnClickModal?: boolean
  showClose?: boolean
}

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
  showTotal?: boolean
  showJumper?: boolean
  size?: Size
  disabled?: boolean
}

export interface FormItemProps {
  label?: string
  prop?: string
  required?: boolean
  rules?: import('./form').FbkRule[]
  help?: string
  /** 同 FormProps.labelWidth，条目级覆盖表单级 */
  labelWidth?: string | number
  span?: number
}

export interface FormProps {
  model: Record<string, any>
  rules?: Record<string, import('./form').FbkRule[]>
  /**
   * 标签宽度。
   *
   * 传 `'auto'` 表示「按本表单里最宽的标签统一」——这是让控件左边缘对齐的
   * 唯一可移植写法。不传时各 UI 库行为不同：element-plus / naive-ui 会
   * 让标签按内容收缩，于是「状态」和「负责人」下面的输入框宽度不一样；
   * vant 则是固定 6.2em。
   *
   * 适配器必须把 `'auto'` 翻译成自己的等价能力；没有该能力的库应退回
   * 自己的固定宽度，而不是写成 `width: auto`（那会让标签重新按内容收缩）。
   */
  labelWidth?: string | number
  labelPosition?: 'left' | 'right' | 'top'
  disabled?: boolean
  size?: Size
  scrollToError?: boolean
}

export interface FormExpose {
  validate: () => Promise<true>
  validateField?: (prop: string | string[]) => Promise<true>
  resetFields: () => void
  clearValidate: (props?: string | string[]) => void
}
