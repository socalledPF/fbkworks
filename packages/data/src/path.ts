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

/**
 * 从响应里取总数。失败时抛错。
 *
 * **null / '' / undefined 必须抛错，不能当成 0。**
 *
 * `Number(null) === 0`、`Number('') === 0` —— 这是挖过的坑：
 * 后端返回 `total: null`（「暂无数据」或字段未初始化时很常见），
 * 契约层静默变成 total=0，分页器显示「共 0 条」，
 * 而实际可能有数据。用户看到的是错误信息，且没有任何报错。
 *
 * 宁可抛错让人发现，也不要静默显示错的分页。
 */
export function extractTotal<TRaw>(
  raw: TRaw,
  spec: string | ((raw: TRaw) => unknown),
): number {
  const value = typeof spec === 'function' ? spec(raw) : getByPath(raw, spec)

  if (value === null || value === undefined || value === '') {
    throw new FbkDataError(
      'path',
      `[fbk/data] 总数位置是 ${value === '' ? '空字符串' : String(value)}，不是有效数字。` +
        `\n  Number(null) === 0，如果静默转换，分页器会显示「共 0 条」但实际可能有数据。` +
        `\n  如果后端确实没有总数，请改用 total: (raw) => rows.length 或直接不传 total。` +
        `\n  实际响应：${previewRaw(raw)}`,
      raw,
    )
  }

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
