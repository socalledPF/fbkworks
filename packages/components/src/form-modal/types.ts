import type { FormSchema, FormGeneratorExpose } from '../form-generator/types'

/**
 * FormModal：把「弹窗 + 表单 + 校验 + 提交」的编排固化下来。
 *
 * 这是 CRUD 链路里最后缺的一环：列表有 CrudPage、表单有 FormGenerator，
 * 但「点新建弹出来填、点编辑回填、提交成功后关闭并刷新列表」这套流程
 * 此前每个页面都要手写一遍 —— Dialog 原语虽然早就有，业务组件却从未用过它。
 *
 * 刻意不做的事：
 *   · 不内置请求库 —— `submit` 是调用方注入的函数
 *   · 不内置表单渲染 —— 复用 FormGenerator 的 schema
 *   · 不内置成功提示 —— 用 `onSuccess` 回调，由业务方决定用 message 还是别的
 */

export type FormModalMode = 'create' | 'edit'

export interface FormModalProps<T extends Record<string, any> = Record<string, any>> {
  /** 显隐，支持 v-model:show */
  show?: boolean
  /** 弹窗标题。不传时按 mode 自动生成「新建」/「编辑」 */
  title?: string
  /** create / edit，只影响默认标题与提交按钮文案 */
  mode?: FormModalMode

  schema: FormSchema<T>
  /** 编辑时回填的初始值；create 时用 defaultValues */
  initialValues?: Partial<T>
  defaultValues?: Partial<T>

  /**
   * 提交处理。返回 Promise：
   *   · resolve  → 视为成功，自动关闭并触发 success
   *   · reject   → 视为失败，保持打开并保留用户输入（错误信息由调用方自行提示）
   * 返回 `false` 也视为失败（方便写 `if (!ok) return false`）。
   */
  submit: (values: Record<string, any>, mode: FormModalMode) => Promise<void | boolean> | void | boolean

  width?: string | number
  /** 移动端是否用底部弹出，默认 true */
  placement?: 'center' | 'bottom'
  closeOnClickModal?: boolean
  /** 提交成功后是否自动关闭，默认 true */
  closeOnSuccess?: boolean
  /** 打开时是否自动聚焦第一个可输入项，默认 true */
  autoFocus?: boolean
  submitText?: string
  cancelText?: string
  /** 提交中是否禁止关闭（防止半途关掉导致状态错乱），默认 true */
  maskClosableWhileSubmitting?: boolean
}

export interface FormModalExpose<T = any> {
  /** 打开（create 模式） */
  open: (values?: Partial<T>) => void
  /** 打开并回填（edit 模式） */
  openEdit: (values: Partial<T>) => void
  close: () => void
  /** 手动触发提交 */
  submit: () => Promise<void>
  /** 当前表单值 */
  getValues: () => Record<string, any>
  /** 表单实例（validate / resetFields 等） */
  formRef: FormGeneratorExpose | undefined
  /** 是否正在提交 */
  submitting: boolean
}
