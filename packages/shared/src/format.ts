const numberFormatterCache = new Map<string, Intl.NumberFormat>()

export function formatNumber(value: unknown, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  const key = JSON.stringify(options ?? {})
  let formatter = numberFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('zh-CN', options)
    numberFormatterCache.set(key, formatter)
  }
  return formatter.format(num)
}

export function formatMoney(value: unknown, precision = 2): string {
  return formatNumber(value, { minimumFractionDigits: precision, maximumFractionDigits: precision })
}

/** 用 Intl 而不是 dayjs，保持库零业务运行时依赖。 */
export function formatDate(
  value: unknown,
  pattern: 'date' | 'datetime' | 'time' = 'date',
): string {
  if (value === null || value === undefined || value === '') return '-'
  const date = value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) return String(value)

  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (pattern === 'time') return hm
  if (pattern === 'datetime') return `${ymd} ${hm}`
  return ymd
}
