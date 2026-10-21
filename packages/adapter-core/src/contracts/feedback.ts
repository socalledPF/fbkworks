/**
 * 命令式反馈 API 的契约。
 *
 * 与声明式原语（Button / DataGrid 等）不同，`Message` 与 `Confirm` 是**函数**：
 * 业务侧写 `feedback.message.success('保存成功')`，而不是放一个组件到模板里。
 * 因此它们不放在 `primitives`（那是一张组件表），而是挂在 `UiAdapter.feedback`。
 *
 * 为什么现在才补：`capabilities.feedback` 早就声明了
 * message / notification / confirm / loading 四项能力，三个适配器都标了 true，
 * 但契约里没有任何对应的 API —— 业务方看到能力为 true 却找不到东西可用。
 */

export type MessageType = 'success' | 'warning' | 'error' | 'info'

export interface MessageOptions {
  /** 显示时长（毫秒）。0 表示不自动关闭 */
  duration?: number
  /** 是否可手动关闭 */
  closable?: boolean
}

/** 命令式消息提示。返回一个可手动关闭的句柄。 */
export interface MessageApi {
  (type: MessageType, content: string, options?: MessageOptions): () => void
  success: (content: string, options?: MessageOptions) => () => void
  warning: (content: string, options?: MessageOptions) => () => void
  error: (content: string, options?: MessageOptions) => () => void
  info: (content: string, options?: MessageOptions) => () => void
}

export interface ConfirmOptions {
  title?: string
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string
  type?: MessageType
  /** 危险操作：确认按钮用危险色 */
  danger?: boolean
}

/**
 * 确认对话框。返回 Promise：确认 resolve(true)，取消/关闭 resolve(false)。
 *
 * 刻意不 reject —— 业务侧最常见的写法是
 * `if (await feedback.confirm(...)) { ... }`，reject 会逼出 try/catch 噪音，
 * 而「用户取消」并不是错误。
 */
export type ConfirmApi = (content: string, options?: ConfirmOptions) => Promise<boolean>

export interface FeedbackApi {
  message: MessageApi
  confirm: ConfirmApi
}
