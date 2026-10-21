import { showToast, showSuccessToast, showFailToast, showConfirmDialog } from 'vant'
import type { ConfirmOptions, FeedbackApi, MessageApi, MessageOptions, MessageType } from '@fbk/adapter-core'

/**
 * vant 的命令式反馈（移动端）。
 *
 * vant 的 toast 只有 success / fail / loading 三种语义，
 * 没有 warning / info —— 映射到普通 toast 并在文案上不做额外加工，
 * 避免"warning 显示成红色失败"这种误导。
 */
const show = (type: MessageType, content: string, options?: MessageOptions) => {
  const duration = options?.duration ?? 2000
  if (type === 'success') {
    showSuccessToast({ message: content, duration })
  } else if (type === 'error') {
    showFailToast({ message: content, duration })
  } else {
    showToast({ message: content, duration })
  }
  // vant 的 toast 不支持手动关闭，返回空句柄保持契约一致
  return () => {}
}

const message = ((type: MessageType, content: string, options?: MessageOptions) =>
  show(type, content, options)) as MessageApi

message.success = (content, options) => show('success', content, options)
message.warning = (content, options) => show('warning', content, options)
message.error = (content, options) => show('error', content, options)
message.info = (content, options) => show('info', content, options)

const confirm = async (content: string, options: ConfirmOptions = {}) => {
  try {
    await showConfirmDialog({
      title: options.title ?? '提示',
      message: content,
      confirmButtonText: options.confirmText ?? '确定',
      cancelButtonText: options.cancelText ?? '取消',
      confirmButtonColor: options.danger ? 'var(--fbk-color-danger)' : undefined,
    })
    return true
  } catch {
    // vant 在取消时 reject，契约要求 resolve(false)
    return false
  }
}

export const feedback: FeedbackApi = { message, confirm }
