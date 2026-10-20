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

/** action 回调收到的上下文 */
export interface ProTableActionContext<T = any> {
  row: T
  index: number
}

/**
 * 操作栏里的一个按钮。
 *
 * `valueType: 'actions'` 的列此前只是类型里的一个标记，没有任何实现 ——
 * 业务侧写了 `valueType: 'actions'` 而不写 `render`，单元格会渲染成空白。
 */
export interface ProTableAction<T = any> {
  key: string
  text: string
  /** 复用 Tag/Button 的状态色语义 */
  status?: Status
  /** text 变体渲染成链接样式，用于「查看」这类次要操作 */
  variant?: 'default' | 'primary' | 'text' | 'link'
  icon?: string
  /** 危险操作二次确认文案；不传则不确认 */
  confirm?: string
  visible?: boolean | ((ctx: ProTableActionContext<T>) => boolean)
  disabled?: boolean | ((ctx: ProTableActionContext<T>) => boolean)
  onClick?: (ctx: ProTableActionContext<T>) => void
}

export interface ProTableColumn<T = Record<string, any>> extends DataGridColumn<T> {
  valueType?: ValueType
  valueEnum?: Record<string | number, ValueEnumItem>
  hideInTable?: boolean
  hideInCard?: boolean
  search?: boolean
  /** 悬停时以原生 tooltip 展示的说明。与 `render` 并存时，说明包在渲染结果外面。 */
  tooltip?: string
  /**
   * 单元格内容可复制：悬停显示复制按钮，点击写入剪贴板。
   * 只在列有 render（valueType 或自定义）时生效；纯文本列想复制请显式写 render。
   */
  copyable?: boolean
  /**
   * `valueType: 'actions'` 时生效：该列渲染成一组操作按钮。
   * 与 `render` 同时存在时，`render` 优先（保留逃生舱）。
   */
  actions?: ProTableAction<T>[]
  /** 最多直接显示几个 action，其余折叠进「更多」。默认 3。 */
  max?: number
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
