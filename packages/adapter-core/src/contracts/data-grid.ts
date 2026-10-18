export type SortOrder = 'asc' | 'desc' | null

export interface SortState {
  field: string
  order: SortOrder
}

export type DataGridPresentation = 'auto' | 'table' | 'cards'

export interface CellRenderContext<T = any> {
  row: T
  index: number
  column: DataGridColumn<T>
  value: unknown
}

export interface DataGridColumn<T = Record<string, any>> {
  key: string
  title: string
  dataIndex?: (keyof T & string) | string
  getValue?: (row: T) => unknown
  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  ellipsis?: boolean
  /**
   * 该列是数值（金额、数量、比率）。
   * 适配器据此给单元格加等宽数字（tabular-nums），让同一位上的数字对齐。
   * 只影响字形，不影响对齐 —— 对齐是 align 的职责。
   */
  numeric?: boolean
  /** 唯一的单元格渲染入口，业务组件与适配器都只认它 */
  render?: (ctx: CellRenderContext<T>) => unknown
  /** 移动端卡片布局提示：主标题 / 隐藏 / 标签文案 / 排序 */
  mobile?: {
    primary?: boolean
    hidden?: boolean
    label?: string
    order?: number
  }
  uiProps?: Record<string, any>
}

export interface DataGridProps<T = any> {
  columns: DataGridColumn<T>[]
  data: T[]
  rowKey?: string | ((row: T) => string | number)
  loading?: boolean
  presentation?: DataGridPresentation
  selectionEnabled?: boolean
  selectedKeys?: Array<string | number>
  sort?: SortState | null
  emptyText?: string
  rowClickable?: boolean
  /** 移动端无限滚动 */
  loadMore?: boolean
  finished?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export interface DataGridEmits<T = any> {
  'update:selectedKeys': [keys: Array<string | number>]
  'update:sort': [sort: SortState | null]
  'row-click': [row: T, index: number, event: Event]
  'load-more': []
}
