/**
 * 数据层错误。
 *
 * 为什么要有专门的错误类型而不是 `new Error()`：
 *   · 调用方需要区分「业务失败」「字段路径写错」「网络失败」
 *   · 前两类是**开发期错误**（该在测试时发现），第三类是运行时错误
 *   · 错误信息里要带实际响应片段，否则排查要重新抓包
 */
export class FbkDataError extends Error {
  /** 错误类别：业务码失败 / 路径解析失败 */
  readonly kind: 'business' | 'path'

  /** 后端原始响应（截断后），用于排查 */
  readonly raw: unknown

  constructor(kind: 'business' | 'path', message: string, raw?: unknown) {
    super(message)
    this.name = 'FbkDataError'
    this.kind = kind
    this.raw = raw
  }
}

/**
 * 把响应截断成可读片段。
 *
 * 为什么要截断：某些后端失败时会返回整页 HTML（网关错误页），
 * 直接把 10KB HTML 塞进错误信息会让控制台难以阅读。
 */
export function previewRaw(raw: unknown, limit = 500): string {
  let text: string
  try {
    text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  } catch {
    // 循环引用等无法序列化的情况
    text = String(raw)
  }
  if (text === undefined) return 'undefined'
  return text.length > limit ? `${text.slice(0, limit)}…（共 ${text.length} 字符）` : text
}
