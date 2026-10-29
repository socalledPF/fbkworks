import { useMessage, useDialog } from 'naive-ui'
import type { ConfirmOptions, FeedbackApi, MessageApi, MessageOptions, MessageType } from '@fbkworks/adapter-core'

/**
 * naive-ui 的命令式反馈。
 *
 * 关键差异：naive 的 useMessage / useDialog **必须在 setup 上下文里调用**，
 * 不能像 element-plus 那样直接 import 一个全局函数。
 * 所以这里暴露一个 `installFeedback()`，由 RootProvider 在 setup 中调用一次，
 * 把实例写进模块级变量，之后业务侧才能用 `feedback.message.success(...)`。
 *
 * 没有 RootProvider 包裹时，message 会降级为 console 并 warnOnce 提示 ——
 * 静默失败会让业务方以为提示弹出来了。
 */
let messageApi: ReturnType<typeof useMessage> | null = null
let dialogApi: ReturnType<typeof useDialog> | null = null

const fallbackWarned = { value: false }

function warnMissing() {
  if (fallbackWarned.value) return
  fallbackWarned.value = true
  if (typeof console !== 'undefined') {
    console.warn(
      '[fbk] naive-ui 的 feedback 需要 <FbkProvider> 包裹（内部会调用 useMessage/useDialog）。' +
        '当前降级为 console 输出。',
    )
  }
}

/** 由 RootProvider 在 setup 中调用 */
export function installFeedback() {
  messageApi = useMessage()
  dialogApi = useDialog()
}

const show = (type: MessageType, content: string, options?: MessageOptions) => {
  if (!messageApi) {
    warnMissing()
    // 用 warn 而不是 log：项目 ESLint 只允许 warn/error，
    // 且降级输出本质上是「本应弹窗但没弹」，属于告警而非普通日志
    if (typeof console !== 'undefined') console.warn(`[fbk:${type}] ${content}`)
    return () => {}
  }
  const instance = messageApi[type](content, {
    duration: options?.duration ?? 3000,
    closable: options?.closable ?? false,
  })
  return () => instance.destroy()
}

const message = ((type: MessageType, content: string, options?: MessageOptions) =>
  show(type, content, options)) as MessageApi

message.success = (content, options) => show('success', content, options)
message.warning = (content, options) => show('warning', content, options)
message.error = (content, options) => show('error', content, options)
message.info = (content, options) => show('info', content, options)

const confirm = (content: string, options: ConfirmOptions = {}) =>
  new Promise<boolean>((resolve) => {
    if (!dialogApi) {
      warnMissing()
      // 没有 provider 时退化为原生 confirm，保证流程不中断
      const ok = typeof window !== 'undefined' ? window.confirm(content) : false
      resolve(ok)
      return
    }
    /* danger 只改确认按钮的配色（契约即「确认按钮用危险色」），图标语义不动 ——
       与 element-plus 的 el-button--danger、vant 的 confirmButtonColor 对齐。
       naive 没有专门的 danger 开关，红按钮只能靠按钮的 type 传下去。
       dialog 的 type 由方法名决定（typedApi 里 type 是后写的），所以这里按 type 选方法。 */
    const type: MessageType = options.danger ? 'warning' : (options.type ?? 'warning')
    dialogApi[type]({
      title: options.title ?? '提示',
      content,
      positiveText: options.confirmText ?? '确定',
      negativeText: options.cancelText ?? '取消',
      positiveButtonProps: options.danger ? { type: 'error' } : undefined,
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
    })
  })

export const feedback: FeedbackApi = { message, confirm }
