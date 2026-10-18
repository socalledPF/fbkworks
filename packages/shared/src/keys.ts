/** 行主键类型。Vue 本身不导出 Key，这里统一定义，避免各包重复。 */
export type Key = string | number

export type RowKeyGetter<T> = string | ((row: T) => Key)

export function getRowKey<T extends Record<string, any>>(
  row: T,
  index: number,
  rowKey: RowKeyGetter<T> = 'id',
): Key {
  if (typeof rowKey === 'function') return rowKey(row)
  const value = row[rowKey]
  return (value as Key) ?? index
}

export function toKeySet(keys: Key[] | undefined): Set<Key> {
  return new Set(keys ?? [])
}
