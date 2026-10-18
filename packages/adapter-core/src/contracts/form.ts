/**
 * 表单规则的最小归一化子集。不暴露任何 UI 库的 rules 类型，
 * 各适配器负责翻译成自己的规则格式。
 */
export interface FbkRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'email' | 'url' | 'date'
  min?: number
  max?: number
  len?: number
  pattern?: RegExp
  message?: string
  trigger?: 'change' | 'blur' | 'submit'
  /** 返回 true 表示通过；返回字符串表示错误信息 */
  validator?: (
    value: any,
    model: Record<string, any>,
  ) => true | string | void | Promise<true | string | void>
}

export type FormRules = Record<string, FbkRule[]>
