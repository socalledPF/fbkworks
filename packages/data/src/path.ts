import { FbkDataError, previewRaw } from './error'

/**
 * 点号路径取值。
 *
 * 为什么需要它：真实后端的列表位置五花八门 ——
 *   `rows`（ruoyi）、`data.records`（很多 Spring 项目）、
 *   `data.list`、`result.items`……
 *
 * 业务方只需写一个字符串，不用写提取函数。
 *
 * **支持数组下标**：`data.list.0.items` 这类结构真实存在
 * （某些接口把列表包在数组里）。
 */
export function getByPath(raw: unknown, path: string): unknown {
  if (!path) return raw

  const segments = path.split('.')
  let current: unknown = raw

  for (const segment of segments) {
    if (current === null || current === undefined) {
      throw new FbkDataError(
        'path',
        `[fbk/data] 路径 "${path}" 解析失败：在第 "${segment}" 段时父级为 ${current}。` +
          `实际响应：${previewRaw(raw)}`,
        raw,
      )
    }

    if (typeof current !== 'object') {
      throw new FbkDataError(
        'path',
        `[fbk/data] 路径 "${path}" 解析失败：第 "${segment}" 段无法从 ${typeof current} 上取属性。` +
          `实际响应：${previewRaw(raw)}`,
        raw,
      )
    }

    // 数组下标：'0' 这类纯数字段
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)]
    } else {
      current = (current as Record<string, unknown>)[segment]
    }
  }

  if (current === undefined) {
    throw new FbkDataError(
      'path',
      `[fbk/data] 路径 "${path}" 解析结果为 undefined。` +
        `多半是字段名写错了 —— 注意：静默返回空列表会让这类错误极难排查。` +
        `实际响应：${previewRaw(raw)}`,
      raw,
    )
  }

  return current
}

/**
 * 从响应里取列表。
 *
 * 路径解析失败时**抛错而不是返回空数组** ——
 * 返回空数组会让用户看到「暂无数据」，而真实原因是字段名写错。
 */
export function extractRows<TRaw>(raw: TRaw, spec: string | ((raw: TRaw) => unknown)): unknown[] {
  const value = typeof spec === 'function' ? spec(raw) : getByPath(raw, spec)

  if (!Array.isArray(value)) {
    throw new FbkDataError(
      'path',
      `[fbk/data] 列表位置不是数组（实际是 ${typeof value}）。实际响应：${previewRaw(raw)}`,
      raw,
    )
  }
  return value
}

/** 从响应里取总数。失败时同样抛错 */
export function extractTotal<TRaw>(
  raw: TRaw,
  spec: string | ((raw: TRaw) => unknown),
): number {
  const value = typeof spec === 'function' ? spec(raw) : getByPath(raw, spec)
  const num = Number(value)

  if (!Number.isFinite(num)) {
    throw new FbkDataError(
      'path',
      `[fbk/data] 总数位置不是有效数字（实际是 ${previewRaw(value)}）。` +
        `实际响应：${previewRaw(raw)}`,
      raw,
    )
  }
  return num
}
