export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

export function toCssSize(value: string | number | undefined): string | undefined {
  if (isNil(value) || value === '') return undefined
  return typeof value === 'number' ? `${value}px` : value
}

/** 只保留已定义的值，用于合并 uiProps 时避免 undefined 覆盖默认值。 */
export function pickDefined<T extends Record<string, any>>(source: T | undefined): Partial<T> {
  if (!source) return {}
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

/**
 * 合并 uiProps。顺序：默认值 < 归一化 props < uiProps。
 * `deny` 中的键不允许被 uiProps 覆盖，防止调用方改坏内部受控状态。
 */
export function mergeUiProps(
  base: Record<string, any> | undefined,
  normalized: Record<string, any>,
  uiProps: Record<string, any> | undefined,
  deny: string[] = [],
): Record<string, any> {
  const merged = { ...pickDefined(base), ...pickDefined(normalized), ...pickDefined(uiProps) }
  for (const key of deny) {
    if (key in normalized) merged[key] = normalized[key]
    else delete merged[key]
  }
  return merged
}
