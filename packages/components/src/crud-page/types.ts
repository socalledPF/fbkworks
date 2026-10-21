import type { VNodeChild } from 'vue'
import type { Key } from '@fbk/shared'
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

  /** 表格的其余透传属性 */
  tableProps?: Omit<ProTableProps<T>, 'columns' | 'request' | 'params' | 'rowKey' | 'selection'>

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

export interface CrudPageSlots {
  /** 表格上方工具栏，参数是当前条件与选中项 */
  toolbar?: (props: { params: Record<string, any>; selectedKeys: Key[] }) => VNodeChild
  /** 批量操作区 */
  'bulk-actions'?: (props: { selectedKeys: Key[]; clear: () => void }) => VNodeChild
  /** 弹窗表单等：放在页面任意位置，业务方自行控制显隐 */
  form?: () => VNodeChild
  /** 覆盖某一列的单元格 */
  [cellSlot: `cell-${string}`]: ((props: any) => VNodeChild) | undefined
}
