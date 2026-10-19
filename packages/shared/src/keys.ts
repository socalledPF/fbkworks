import { warnOnce } from './warn'

/** 行主键类型。Vue 本身不导出 Key，这里统一定义，避免各包重复。 */
export type Key = string | number

export type RowKeyGetter<T> = string | ((row: T) => Key)

/**
 * 行缺主键时的回退前缀。
 *
 * 旧实现直接回退到 `index`，但 index 与合法主键处在同一个值域里：
 * `rows = [{}, { id: 0 }]` 会产出两个 `0`，勾选一行同时勾中另一行，
 * `v-for :key` 重复还会让 DOM 被复用错乱。加前缀后回退值与业务主键
 * 不可能相撞 —— 业务主键不会以这个字符串开头。
 */
const INDEX_FALLBACK_PREFIX = '__fbk_row_index__'

function fallbackKey(index: number, reason: string): string {
  warnOnce(
    `row-key-missing:${reason}`,
    `getRowKey 在该行取不到主键（${reason}），已回退为位置索引。` +
      '勾选与排序会依赖行顺序，请在 columns/rowKey 中指定一个稳定的主键字段。',
  )
  return `${INDEX_FALLBACK_PREFIX}${index}`
}

export function getRowKey<T extends Record<string, any>>(
  row: T,
  index: number,
  rowKey: RowKeyGetter<T> = 'id',
): Key {
  if (typeof rowKey === 'function') {
    const value = rowKey(row)
    // 函数式 rowKey 也可能返回 undefined（例如组合字段缺失），同样要兜底
    return value ?? fallbackKey(index, 'rowKey 函数返回空值')
  }

  const value = row[rowKey]
  // 只挡 null / undefined：0 与空串都是合法主键，用 ?? 判断才不会误伤
  return value ?? fallbackKey(index, `字段 "${rowKey}" 为空`)
}

export function toKeySet(keys: Key[] | undefined): Set<Key> {
  return new Set(keys ?? [])
}
