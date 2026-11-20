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
  /* size 已删除：三个适配器的 Spin 都没有 size prop，传了只会经 {...attrs}
     漏成 <div size="lg"> 这种非法属性（与 loadMore/finished 同一类问题）。 */
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

/**
 * 抽屉（详情面板）。
 *
 * 与 Dialog 分开而不是给它加 `placement: 'right'`：两者承载的语义不同 ——
 * Dialog 是「打断当前操作」的模态框（遮罩 + 焦点陷阱 + 居中/贴底），
 * Drawer 是「从一侧滑出、可以边看边操作」的容器。
 * 把两种语义塞进一个原语，会让遮罩与焦点行为在每个适配器里分叉。
 *
 * Drawer 必须能承载 header（title + 关闭）与默认插槽（内容）。
 */
export interface DrawerProps {
  modelValue?: boolean
  title?: string
  /** 桌面默认宽度；移动端一律全屏 */
  width?: string | number
  /** 打开方向。桌面用 right，移动端用 bottom（全屏） */
  placement?: 'right' | 'bottom'
  closeOnClickModal?: boolean
  showClose?: boolean
}

export interface PaginationProps {
  /**
   * 分页形态。默认值由各适配器自己决定，但**必须与它的
   * `capabilities.pagination.mode` 一致** —— 能力位说 infinite、原语默认却是页码时，
   * 「只通过 primitives.* 使用」的业务方会拿到与能力声明相反的东西。
   *
   * 移动端适配器（vant）默认 `'infinite'`，桌面端默认 `'pages'`。
   */
  mode?: 'pages' | 'infinite'
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
  /* span 已删除：三个适配器的 FormItem 都只声明不实现（props.span 引用数为 0）。
     「表单跨列」如果要做，正确形态是 QueryForm 层面的 columns 布局开关，
     而不是让每个字段自己写 span —— 那样才能在移动端做响应式单列。 */
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
  /**
   * **重置字段**：清值 + 清校验。
   *
   * 三端的实现能力不同，这一点必须知道：
   *   · element-plus：原生支持（ElForm.resetFields）
   *   · naive-ui / vant：Form 拿不到「初始值」，只能清校验 ——
   *     调用时会 warnOnce 提示，清值需要业务方自己重置 v-model
   * 只想清红框、不动输入值的场景请用 clearValidate。
   */
  resetFields: () => void
  /** **只清校验状态**（不清值）。三端语义一致。 */
  clearValidate: (props?: string | string[]) => void
}
