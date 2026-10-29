import { ElMessage, ElMessageBox } from 'element-plus'
import type { ConfirmOptions, FeedbackApi, MessageApi, MessageOptions, MessageType } from '@fbkworks/adapter-core'

/**
 * element-plus 的命令式反馈。
 *
 * 注意 `confirm` 在用户取消时是 **reject**（ElMessageBox 的既有行为），
 * 而契约要求 resolve(false) —— 不转的话业务侧每处都要写 try/catch。
 */
const show = (type: MessageType, content: string, options?: MessageOptions) => {
  const instance = ElMessage({
    type: type === 'error' ? 'error' : type,
    message: content,
    duration: options?.duration ?? 3000,
    showClose: options?.closable ?? false,
  })
  return () => instance.close()
}

const message = ((type: MessageType, content: string, options?: MessageOptions) =>
  show(type, content, options)) as MessageApi

message.success = (content, options) => show('success', content, options)
message.warning = (content, options) => show('warning', content, options)
message.error = (content, options) => show('error', content, options)
message.info = (content, options) => show('info', content, options)

const confirm = async (content: string, options: ConfirmOptions = {}) => {
  try {
    await ElMessageBox.confirm(content, options.title ?? '提示', {
      confirmButtonText: options.confirmText ?? '确定',
      cancelButtonText: options.cancelText ?? '取消',
      type: options.danger ? 'warning' : (options.type ?? 'warning'),
      // 危险操作给确认按钮上危险色
      confirmButtonClass: options.danger ? 'el-button--danger' : undefined,
    })
    return true
  } catch {
    // 「用户取消」不是错误，契约要求 resolve(false)
    return false
  }
}

export const feedback: FeedbackApi = { message, confirm }
