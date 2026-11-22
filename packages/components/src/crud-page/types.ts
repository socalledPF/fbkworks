import type { VNodeChild } from 'vue'
import type { Key } from '@fbkworks/shared'
import type { ProTableColumn, ProTableProps, TableRequest } from '../pro-table/types'
import type { QueryField, QueryFormProps } from '../query-form/types'

/**
 * CrudPage：把「查询表单 + 表格 + 分页 + 请求」这四件事的联动固化下来。
 *
 * 企业后台 80% 的页面是这个骨架：上面一排放筛选条件，下面一个表格，
 * 点查询重置页码、点重置清空条件并刷新。此前每个页面都要手写这段联动
 * （demos 里的 with-query.vue 就是在演示手工连接），且很容易漏掉
 * 「重置要连表格一起重置」这类细节。
 *
 * 刻意**不做**的事（避免变成项目文档里批判过的「万能组件」）：
 *   · 不内置弹窗表单 —— 用 `form` 插槽交给业务方
 *   · 不内置请求库 —— request 仍是调用方注入的函数
 *   · 不内置增删改 —— 只负责列表这一屏
 */

export interface CrudPageProps<T extends Record<string, any> = Record<string, any>> {
  /** 查询表单字段。为空数组或不传时不渲染查询区 */
  queryFields?: QueryField[]
  queryProps?: Omit<QueryFormProps, 'fields' | 'modelValue'>

  columns: ProTableColumn<T>[]
  /** 数据源，签名与 ProTable 一致 */
  request: TableRequest<T>
  rowKey?: ProTableProps<T>['rowKey']

  /**
   * 选择配置。与 ProTable 一致：false 关闭，对象形式配置列宽与保留策略。
   * 提到顶层是因为「列表页多选」是 CRUD 场景的高频需求，
   * 塞进 tableProps 里会让调用方多绕一层。
   */
  selection?: ProTableProps<T>['selection']

  /**
   * 表格的其余透传属性。
   *
   * `immediate` 不在其中，且**类型上直接拒绝**：它由上面那个顶层 prop 唯一决定，
   * 而 CrudPage 展开时 `immediate: props.immediate` 排在 `...tableProps` 之后 ——
   * 写在这里会被静默压掉（type 合法、行为无效，最难查的那类）。
   * 要关掉首屏请求请用 `<FbkCrudPage :immediate="false">`。
   */
  tableProps?: Omit<
    ProTableProps<T>,
    'columns' | 'request' | 'params' | 'rowKey' | 'selection' | 'immediate'
  >

  /** 首屏是否自动查询，默认 true */
  immediate?: boolean

  /** 查询区是否默认折叠 */
  defaultCollapsed?: boolean
}

export interface CrudPageExpose<T = any> {
  /** 重新查询（保留当前筛选条件） */
  refresh: () => Promise<void>
  /** 清空筛选条件并重新查询 */
  reset: () => Promise<void>
  /** 当前生效的查询条件 */
  getParams: () => Record<string, any>
  /** 当前行数据 */
  getData: () => T[]
  /** 当前选中项 */
  getSelectedKeys: () => Key[]
  /** 清空选择 */
  clearSelection: () => void
}

/**
 * CrudPage 会转发的全部插槽。
 *
 * 这份名单必须与 CrudPage.vue 的 `passedSlots` / `passedQuerySlots` 两个白名单逐字对齐：
 * 白名单漏一个 = 业务方传了没效果、也不报错；类型漏一个 = 模板里报错或 IDE 不补全。
 * 两边是同一件事的两半，删改任何一侧都要同时改另一侧。
 */
export interface CrudPageSlots {
  /** 表格上方工具栏，参数是当前条件与选中项 */
  toolbar?: (props: { params: Record<string, any>; selectedKeys: Key[] }) => VNodeChild
  /** 批量操作区。与 ProTable 同一条件渲染（开启多选 + 当前页有数据） */
  'bulk-actions'?: (props: { selectedKeys: Key[]; clear: () => void }) => VNodeChild
  /** 覆盖表格的错误态（加载失败时替代表格出现） */
  error?: (props: { error: unknown; retry: () => void }) => VNodeChild
  /** 自定义空态；不传就用适配器自己的空态 */
  empty?: () => VNodeChild
  /** 卡片模式下每张卡片的页脚 */
  'card-footer'?: (props: any) => VNodeChild
  /** 弹窗表单等：放在页面任意位置，业务方自行控制显隐 */
  form?: () => VNodeChild
  /** 查询区按钮组之前（QueryForm 的 before-actions） */
  'before-actions'?: (props: { params: Record<string, any>; selectedKeys: Key[] }) => VNodeChild
  /** 查询区按钮组之后（QueryForm 的 after-actions） */
  'after-actions'?: (props: { params: Record<string, any>; selectedKeys: Key[] }) => VNodeChild
  /** 查询区按钮组末尾（QueryForm 的 actions），放「导出」这类次要操作 */
  actions?: (props: { params: Record<string, any>; selectedKeys: Key[] }) => VNodeChild
  /** 覆盖某一列的单元格，插槽名 `cell-${key}` */
  [cellSlot: `cell-${string}`]: ((props: any) => VNodeChild) | undefined
  /** 给单个筛选项换控件，插槽名 `field-${name}`；参数同 QueryForm 的 `{ value, setValue, values }` */
  [fieldSlot: `field-${string}`]: ((props: any) => VNodeChild) | undefined
}
