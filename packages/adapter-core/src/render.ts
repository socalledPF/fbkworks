import type { CellRenderContext, DataGridColumn } from './contracts/data-grid'

export function getCellValue<T>(column: DataGridColumn<T>, row: T): unknown {
  if (column.getValue) return column.getValue(row)
  if (column.dataIndex) return (row as Record<string, unknown>)[column.dataIndex]
  return (row as Record<string, unknown>)[column.key]
}

/**
 * 适配器共用的单元格渲染入口。
 * 有 column.render 就用；否则取 getValue/dataIndex 转成字符串。
 * 业务语义（money/date/enum/tag）由业务组件解析成 render，适配器不需要知道。
 */
export function renderCell<T>(column: DataGridColumn<T>, row: T, index: number): unknown {
  const value = getCellValue(column, row)
  if (column.render) {
    return column.render({ row, index, column, value } satisfies CellRenderContext<T>)
  }
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}
