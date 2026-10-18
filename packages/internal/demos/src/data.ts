export interface OrderRow {
  id: number
  orderNo: string
  customer: string
  amount: number
  status: 0 | 1 | 2
  createdAt: string
}

export const orderStatusEnum = {
  0: { text: '待支付', status: 'warning' as const },
  1: { text: '已完成', status: 'success' as const },
  2: { text: '已取消', status: 'danger' as const },
}

export const orders: OrderRow[] = Array.from({ length: 48 }, (_, index) => ({
  id: index + 1,
  orderNo: `SO2026${String(index + 1).padStart(4, '0')}`,
  customer: ['张三', '李四', '王五', '赵六'][index % 4],
  amount: Math.round((index + 1) * 137.45 * 100) / 100,
  status: (index % 3) as 0 | 1 | 2,
  createdAt: new Date(2026, 8, (index % 28) + 1, 10, 30).toISOString(),
}))

/** 模拟分页接口，带 300ms 延迟，便于观察 loading 与竞态。 */
export function queryOrders(params: {
  page: number
  pageSize: number
  params: Record<string, any>
}) {
  const keyword = String(params.params.keyword ?? '').trim()
  const status = params.params.status
  const filtered = orders.filter((order) => {
    const matchKeyword = keyword
      ? order.orderNo.includes(keyword) || order.customer.includes(keyword)
      : true
    const matchStatus = status === undefined || status === null || status === '' ? true : order.status === status
    return matchKeyword && matchStatus
  })
  const start = (params.page - 1) * params.pageSize
  return new Promise<{ list: OrderRow[]; total: number }>((resolve) => {
    setTimeout(
      () => resolve({ list: filtered.slice(start, start + params.pageSize), total: filtered.length }),
      300,
    )
  })
}
