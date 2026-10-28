/**
 * CSS 变量解析。
 *
 * **为什么必须做这一步**：ECharts 用 Canvas 绘制，Canvas API 不认 CSS 变量。
 * 直接写 `color: 'var(--fbk-chart-1)'` 会抛
 * `addColorStop: The value provided could not be parsed as a color`，
 * 图表看起来"没上色"或整个不渲染。
 *
 * 解决办法：读取时把 `var(--x)` 解析成计算后的真实色值再交给 ECharts。
 * 这样业务侧仍可只写令牌名，换主题时由 CSS 决定颜色。
 */

const VAR_RE = /^var\(\s*(--[a-zA-Z0-9-_]+)\s*(?:,\s*([^)]+))?\)$/

/** 判断是否是需要解析的 CSS 变量引用 */
export function isCssVar(value: unknown): value is string {
  return typeof value === 'string' && VAR_RE.test(value.trim())
}

/**
 * 把 `var(--x)` 或 `var(--x, fallback)` 解析成真实色值。
 *
 * 非变量引用原样返回（例如 '#fff'、'rgba(0,0,0,.1)'、'transparent'）。
 */
export function resolveCssValue(value: string): string {
  const match = VAR_RE.exec(value.trim())
  if (!match) return value
  if (typeof document === 'undefined') return match[2]?.trim() ?? value

  const [, name, fallback] = match
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(name!).trim()
  return resolved || fallback?.trim() || value
}

/** 纯对象：原型是 Object 或 null。只有它的键值能安全地拆开重建 */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * 深度遍历 option，把所有 `var(--x)` 字符串解析成真实色值。
 *
 * 为什么深度遍历而不是只在几个已知字段上处理：
 * option 结构由业务方决定（gradient 的 colorStops、markLine 的 lineStyle 等
 * 都可能有颜色），逐字段枚举必然漏。遍历成本很低（option 是纯对象）。
 *
 * 只重建纯对象。Date / TypedArray / Map / 类实例的键值不是它的语义
 * （dataset.source 里的 Date 拆开就是 {}，Float32Array 拆开就是数字键对象），
 * 重建等于把它们毁掉 —— 图表不会报错，只会静默空白或时间轴 NaN。
 */
export function resolveOptionVars<T>(input: T): T {
  if (typeof input === 'string') {
    return (isCssVar(input) ? resolveCssValue(input) : input) as unknown as T
  }
  if (Array.isArray(input)) {
    return input.map((item) => resolveOptionVars(item)) as unknown as T
  }
  if (input && typeof input === 'object' && isPlainObject(input)) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = resolveOptionVars(value)
    }
    return out as T
  }
  return input
}
