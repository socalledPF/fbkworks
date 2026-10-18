const warned = new Set<string>()

const PREFIX = '[fbk]'

export function warn(message: string): void {
  if (typeof console !== 'undefined') console.warn(`${PREFIX} ${message}`)
}

/** 同一 key 只提示一次，避免在渲染循环里刷屏。 */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  warn(message)
}

export function resetWarnCache(): void {
  warned.clear()
}
