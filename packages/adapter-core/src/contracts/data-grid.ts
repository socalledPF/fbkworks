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
  /* `presentation` 曾经在这里，但三个适配器**一次都没读过它**（grep 'props.presentation' 为 0）：
     业务侧传 'cards' 得到的是「卡片类的外壳 + 表格 DOM」，静默无效。
     展示形态唯一的真相是能力位 `capabilities.dataGrid.presentation`（ProTable 用它决定外壳类名）。
     一个没人实现的字段比没有字段更糟 —— 它让类型定义看起来支持，实际不支持。 */
  selectionEnabled?: boolean
  selectedKeys?: Array<string | number>
  /**
   * 选择列宽度。默认 48。
   * 原先三个适配器各自在内部写死 48，业务侧没法调；
   * 现在由 ProTable 的 `selection.columnWidth` 传下来。
   */
  selectionWidth?: number
  /* `sort` 入参同样删除：只有 element-plus 读过它（用来设 defaultSort），
     naive / vant 完全忽略 —— 受控排序在 2/3 适配器上不生效。
     排序的对外契约只剩事件 `update:sort`（ProTable 据此驱动请求）。 */
  emptyText?: string
  rowClickable?: boolean
  /** 移动端无限滚动 */
  loadMore?: boolean
  finished?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * DataGrid 的插槽契约。目前只有一个 `empty`。
 *
 * 为什么是插槽而不是又一个组件：`FbkEmpty` 曾经存在并被删掉 ——
 * 它只是把「空态」这件事又包了一层，多一个要同步的入口，而它本身没有任何行为。
 * 空态的默认实现由各适配器用自己的空态组件渲染（`emptyText` 作为文案），
 * 业务方需要自定义时传这一个插槽即可。
 *
 * 适配器实现要求：提供了 `empty` 就用它，没提供才渲染默认空态 ——
 * 三者语义必须一致，否则「换库外观不变」这条承诺在这里就断了。
 */
export interface DataGridSlots {
  empty?: () => any
}

export interface DataGridEmits<T = any> {
  'update:selectedKeys': [keys: Array<string | number>]
  /**
   * `sort.field` 一律取 `column.dataIndex`，dataIndex 缺省时回退 `column.key` ——
   * 三个适配器共用这一语义，后端收到的字段名不随适配器改变。
   * 撤销排序时 payload 整体为 null。
   */
  'update:sort': [sort: SortState | null]
  'row-click': [row: T, index: number, event: Event]
  'load-more': []
}
