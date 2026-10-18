/**
 * 消费者烟雾测试：不经过 tsconfig paths，直接按 package.json exports 解析已构建的 dist。
 *
 * 它验证的是"发布出去之后"的形态：
 * - d.ts 里的相对说明符能解析（node16/nodenext 不做目录索引查找）；
 * - @fbk/* 的跨包引用走包名而不是源码相对路径；
 * - 公开 API 不含 UI 库类型。
 */
import { FbkProTable, useTableRequest } from '@fbk/components/pro-table'
import { FbkQueryForm } from '@fbk/components/query-form'
import { FbkFormGenerator } from '@fbk/components/form-generator'
import { FbkPageContainer } from '@fbk/components/page-container'
import { FbkDescriptions } from '@fbk/components/descriptions'
import { createBusinessKit, useAdapter } from '@fbk/adapter-core'
import type { ProTableColumn, TableRequestParams } from '@fbk/components/pro-table'
import type { SortState, UiAdapter } from '@fbk/adapter-core'
import { elementPlusAdapter } from '@fbk/adapter-element-plus'
import { vantAdapter } from '@fbk/adapter-vant'
import { naiveUiAdapter } from '@fbk/adapter-naive-ui'
import { FbkResolver } from '@fbk/resolver'

interface Order {
  id: number
  orderNo: string
  amount: number
}

const columns: ProTableColumn<Order>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
]

const request = async (params: TableRequestParams): Promise<{ list: Order[]; total: number }> => {
  const sort: SortState | null = params.sort
  void sort
  return { list: [], total: 0 }
}

export const components = [
  FbkProTable,
  FbkQueryForm,
  FbkFormGenerator,
  FbkPageContainer,
  FbkDescriptions,
]

export const adapters: UiAdapter[] = [elementPlusAdapter, vantAdapter, naiveUiAdapter]

export const plugin = createBusinessKit({ adapter: elementPlusAdapter })

export const resolver = FbkResolver()

export { columns, request, useTableRequest, useAdapter }
