import type { VNodeChild } from 'vue'
import type { DataGridColumn, SortState, Status } from '@fbkworks/adapter-core'
import type { Key } from '@fbkworks/shared'
import type { Page, PageQuery } from '@fbkworks/data'

/*
 * 分页契约的**唯一定义处是 @fbkworks/data**，这里是别名。
 *
 * 之前两处各写一份同形接口，靠注释声称「保证兼容」——
 * 实际没有任何类型保障：改了一处，另一处不会报错，注释继续说兼容。
 * 现在改 @fbkworks/data 就会在这里一起生效。
 *
 * 唯一的语义差异：`TableResponse.total` 可选，`Page.total` 必填。
 * 业务方手写 fetcher 时可能拿不到总数（这时组件用 list.length 兜底），
 * 所以这里保留可选；`createPageRequest` 的产物 total 一定存在，
 * 可以安全地赋给 TableRequest。
 */
export type TableRequestParams = PageQuery

export type TableResponse<T> = Omit<Page<T>, 'total'> & { total?: number }

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

export interface ProTableSlots {
  /** 表格上方工具栏 */
  toolbar?: (props: { selectedKeys: Key[]; reload: () => Promise<void> }) => VNodeChild
  /** 批量操作区，仅在选中行时渲染 */
  'bulk-actions'?: (props: { selectedKeys: Key[]; clear: () => void }) => VNodeChild
  /** 卡片模式下每张卡片的页脚，参数由适配器决定 */
  'card-footer'?: (props: any) => VNodeChild
  /** 请求失败时替代表格出现的错误态 */
  error?: (props: { error: unknown; retry: () => Promise<void> }) => VNodeChild
  /** 覆盖某一列的单元格，插槽名 `cell-${key}` */
  [cellSlot: `cell-${string}`]: ((props: any) => VNodeChild) | undefined
}

export interface ProTableExpose<T = any> {
  reload: (options?: { resetPage?: boolean }) => Promise<void>
  getData: () => T[]
  clearSelection: () => void
  setSelectedKeys: (keys: Key[]) => void
}
