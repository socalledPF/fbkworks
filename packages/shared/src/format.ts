/**
 * 数字与日期格式化。用 Intl 而不是 dayjs，保持库零业务运行时依赖。
 *
 * locale 由调用方显式传入，默认 `zh-CN`。
 * L1 是纯函数层，不读注入上下文 —— 业务组件从 `useFbkTheme().locale` 取到
 * 之后再传进来，这样 shared 不需要反向依赖 adapter-core。
 */

export const DEFAULT_LOCALE = 'zh-CN'

/** formatter 缓存上限。SSR 下这是模块级状态，必须有界。 */
const MAX_CACHED_FORMATTERS = 50

const numberFormatterCache = new Map<string, Intl.NumberFormat>()

/**
 * 缓存键：locale + 排序后的 options。
 *
 * 直接 `JSON.stringify(options)` 有两个问题：
 * 1. 键序敏感 —— `{a,b}` 与 `{b,a}` 语义相同却建两份 formatter；
 * 2. 不区分 locale，切语言后仍命中旧表。
 * 排序后再序列化，这两种情况都能稳定命中同一条目。
 */
function cacheKey(locale: string, options: Intl.NumberFormatOptions | undefined): string {
  if (!options) return locale
  const sorted = Object.keys(options)
    .sort()
    .map((key) => [key, (options as Record<string, unknown>)[key]])
  return `${locale}|${JSON.stringify(sorted)}`
}

function getFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = cacheKey(locale, options)
  const cached = numberFormatterCache.get(key)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, options)
  // 简单的 FIFO 淘汰：Map 保持插入顺序，超限就删最旧的一条
  if (numberFormatterCache.size >= MAX_CACHED_FORMATTERS) {
    const oldest = numberFormatterCache.keys().next().value
    if (oldest !== undefined) numberFormatterCache.delete(oldest)
  }
  numberFormatterCache.set(key, formatter)
  return formatter
}

export function formatNumber(
  value: unknown,
  options?: Intl.NumberFormatOptions,
  locale: string = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return getFormatter(locale, options).format(num)
}

export function formatMoney(value: unknown, precision = 2, locale: string = DEFAULT_LOCALE): string {
  return formatNumber(
    value,
    { minimumFractionDigits: precision, maximumFractionDigits: precision },
    locale,
  )
}

/**
 * 日期格式化。
 *
 * 接受 `Date`、毫秒数、或含时区信息的 ISO 字符串，统一按**本地时区**渲染。
 * 布尔值等非日期输入原样返回：`new Date(true)` 会得到 1970-01-01，
 * 在表格里显示成一个"看着像有效"的日期，比原样返回更危险。
 *
 * 为什么 zh-CN 不用 Intl.DateTimeFormat 排版：
 * Intl 在 zh-CN 下输出 `2026/09/01`（斜杠），而历史实现一直输出
 * `2026-09-01`（短横线）。表格里的日期列是高频视觉元素，换成 Intl
 * 会改变所有既有页面的观感，属于该避免的零收益回归。
 * 因此 zh-CN 保留手工拼接，其他 locale 才交给 Intl。
 */
export function formatDate(
  value: unknown,
  pattern: 'date' | 'datetime' | 'time' = 'date',
  locale: string = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined || value === '') return '-'
  // 只接受 Date / number / string，其余一律原样返回
  if (typeof value !== 'number' && typeof value !== 'string' && !(value instanceof Date)) {
    return String(value)
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  if (locale === DEFAULT_LOCALE) return formatZhCn(date, pattern)

  return new Intl.DateTimeFormat(locale, DATE_PATTERNS[pattern]).format(date)
}

/** zh-CN 的历史格式，逐字保持不变。 */
function formatZhCn(date: Date, pattern: 'date' | 'datetime' | 'time'): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (pattern === 'time') return hm
  if (pattern === 'datetime') return `${ymd} ${hm}`
  return ymd
}

/**
 * 非 zh-CN 的日期格式。zh-CN 走 formatZhCn，不经过这里。
 */
const DATE_PATTERNS = {
  date: { year: 'numeric', month: '2-digit', day: '2-digit' },
  datetime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

/** 测试辅助：缓存条数。不属于公开 API。 */
export function formatterCacheSize(): number {
  return numberFormatterCache.size
}

/** 测试辅助：清空缓存，避免用例之间互相污染。不属于公开 API。 */
export function resetFormatterCache(): void {
  numberFormatterCache.clear()
}
