import type { DataGridColumn, SortState, Status } from '@fbk/adapter-core'
import type { Key } from '@fbk/shared'

export interface TableRequestParams {
  page: number
  pageSize: number
  sort: SortState | null
  params: Record<string, any>
  signal: AbortSignal
}

export interface TableResponse<T> {
  list: T[]
  total?: number
  hasMore?: boolean
}

export type TableRequest<T> = (params: TableRequestParams) => Promise<TableResponse<T>>

export type ValueType =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime'
  | 'tag'
  | 'enum'
  | 'image'
  | 'actions'

export interface ValueEnumItem {
  text: string
  status?: Status
}

export interface ProTableColumn<T = Record<string, any>> extends DataGridColumn<T> {
  valueType?: ValueType
  valueEnum?: Record<string | number, ValueEnumItem>
  hideInTable?: boolean
  hideInCard?: boolean
  search?: boolean
  tooltip?: string
  copyable?: boolean
}

export interface ProTableUiProps {
  grid?: Record<string, any>
  toolbar?: Record<string, any>
  pagination?: Record<string, any>
  actions?: Record<string, any>
}

export interface ProTableProps<T extends Record<string, any> = Record<string, any>> {
  columns: ProTableColumn<T>[]
  rowKey?: (keyof T & string) | ((row: T) => Key)

  /** 受控数据；与 request 二选一 */
  data?: T[]
  /** 非受控数据源 */
  request?: TableRequest<T>
  params?: Record<string, any>

  loading?: boolean
  emptyText?: string
  presentation?: 'auto' | 'table' | 'cards'

  page?: number
  pageSize?: number
  total?: number
  pagination?: false | { pageSizes?: number[]; showTotal?: boolean; showJumper?: boolean }

  selection?: false | { preserveOnReload?: boolean; columnWidth?: number }
  selectedKeys?: Key[]

  sort?: SortState | null
  toolbar?: boolean
  uiProps?: ProTableUiProps
}

export interface ProTableExpose<T = any> {
  reload: (options?: { resetPage?: boolean }) => Promise<void>
  getData: () => T[]
  clearSelection: () => void
  setSelectedKeys: (keys: Key[]) => void
}
