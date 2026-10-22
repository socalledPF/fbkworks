/**
 * Mock 数据层。
 *
 * 刻意模拟真实后端的三个特征，用来压测组件库：
 *   1. **分页 + 排序 + 多条件筛选**都在「服务端」完成（不是前端过滤）
 *   2. **随机延迟**（150-450ms），能暴露竞态与 loading 状态问题
 *   3. **AbortSignal** 生效 —— 快速切换查询条件时旧请求应被取消
 *
 * 数据是确定性生成的（固定种子），刷新后保持一致，便于截图对比。
 */

import type { TableRequestParams, TableResponse } from '@fbk/components/pro-table'
import type { Status } from '@fbk/adapter-core'

// ---------- 确定性伪随机 ----------

/** 简单的 LCG，保证每次刷新数据一致 */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const rand = makeRandom(20261022)

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

/** 模拟网络延迟，并响应 AbortSignal */
function delay(signal?: AbortSignal, base = 150, spread = 300): Promise<void> {
  const ms = base + Math.floor(Math.random() * spread)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      // DOMException 是浏览器取消请求的标准表现，组件库需要能正确处理
      reject(new DOMException('请求已取消', 'AbortError'))
    })
  })
}

// ---------- 订单 ----------

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded'

export const ORDER_STATUS_MAP: Record<OrderStatus, { text: string; status: Status }> = {
  pending: { text: '待支付', status: 'warning' },
  paid: { text: '已支付', status: 'info' },
  // 'processing' 不在 Status 联合里，用 primary 表达"进行中"
  shipped: { text: '已发货', status: 'primary' },
  completed: { text: '已完成', status: 'success' },
  cancelled: { text: '已取消', status: 'default' },
  refunded: { text: '已退款', status: 'danger' },
}

export interface OrderRow {
  id: number
  orderNo: string
  customer: string
  phone: string
  channel: '直营' | '分销' | '电商' | '门店'
  amount: number
  status: OrderStatus
  itemCount: number
  createdAt: string
  paidAt: string | null
  address: string
  remark: string
}

const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'] as const
const GIVEN = ['伟', '芳', '娜', '敏', '静', '强', '磊', '洋', '艳', '杰'] as const
const CITIES = ['上海', '北京', '深圳', '杭州', '成都', '广州', '南京', '武汉'] as const
const CHANNELS = ['直营', '分销', '电商', '门店'] as const
const STATUSES: OrderStatus[] = ['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded']

function makeOrder(i: number): OrderRow {
  const status = pick(STATUSES)
  const created = new Date(2026, 8, between(1, 30), between(8, 22), between(0, 59))
  const paid = status === 'pending' || status === 'cancelled' ? null : new Date(created.getTime() + between(1, 120) * 60000)

  return {
    id: i,
    orderNo: `SO2026${String(i).padStart(6, '0')}`,
    customer: `${pick(SURNAMES)}${pick(GIVEN)}`,
    phone: `1${between(3, 9)}${String(between(100000000, 999999999))}`,
    channel: pick(CHANNELS),
    amount: between(99, 29999) + between(0, 99) / 100,
    status,
    itemCount: between(1, 8),
    createdAt: created.toISOString(),
    paidAt: paid ? paid.toISOString() : null,
    address: `${pick(CITIES)}市${pick(['浦东新区', '朝阳区', '南山区', '西湖区', '武侯区'])}${between(1, 200)}号`,
    remark: rand() > 0.7 ? '客户要求加急处理' : '',
  }
}

export const ORDERS: OrderRow[] = Array.from({ length: 128 }, (_, i) => makeOrder(i + 1))

/** 订单列表接口。完整模拟后端：筛选 → 排序 → 分页 */
export async function fetchOrders(
  params: TableRequestParams,
): Promise<TableResponse<OrderRow>> {
  await delay(params.signal)

  const { keyword, status, channel, dateRange } = params.params as {
    keyword?: string
    status?: OrderStatus
    channel?: string
    dateRange?: [string, string]
  }

  let rows = ORDERS.slice()

  if (keyword) {
    const kw = String(keyword).trim().toLowerCase()
    rows = rows.filter(
      (r) => r.orderNo.toLowerCase().includes(kw) || r.customer.toLowerCase().includes(kw) || r.phone.includes(kw),
    )
  }
  if (status) rows = rows.filter((r) => r.status === status)
  if (channel) rows = rows.filter((r) => r.channel === channel)
  if (dateRange?.[0] && dateRange?.[1]) {
    const [from, to] = dateRange
    rows = rows.filter((r) => {
      const d = r.createdAt.slice(0, 10)
      return d >= from && d <= to
    })
  }

  // 服务端排序。SortState 的形状是 { field, order }，order 可能为 null
  if (params.sort?.order) {
    const { field, order } = params.sort
    rows.sort((a, b) => {
      const av = (a as any)[field]
      const bv = (b as any)[field]
      if (av === bv) return 0
      const result = av > bv ? 1 : -1
      return order === 'desc' ? -result : result
    })
  }

  const total = rows.length
  const start = (params.page - 1) * params.pageSize
  return { list: rows.slice(start, start + params.pageSize), total }
}

/** 订单详情 */
export async function fetchOrder(id: number, signal?: AbortSignal): Promise<OrderRow | null> {
  await delay(signal, 100, 150)
  return ORDERS.find((o) => o.id === id) ?? null
}

/** 批量删除 */
export async function deleteOrders(ids: number[], signal?: AbortSignal): Promise<number> {
  await delay(signal, 200, 200)
  for (const id of ids) {
    const idx = ORDERS.findIndex((o) => o.id === id)
    if (idx >= 0) ORDERS.splice(idx, 1)
  }
  return ids.length
}

/** 保存订单（新增/编辑） */
export async function saveOrder(row: Partial<OrderRow>, signal?: AbortSignal): Promise<OrderRow> {
  await delay(signal, 200, 200)
  if (row.id) {
    const idx = ORDERS.findIndex((o) => o.id === row.id)
    if (idx >= 0) {
      ORDERS[idx] = { ...ORDERS[idx]!, ...row } as OrderRow
      return ORDERS[idx]!
    }
  }
  const created = makeOrder(ORDERS.length + 1)
  ORDERS.unshift({ ...created, ...row } as OrderRow)
  return ORDERS[0]!
}

// ---------- 用户 ----------

export interface UserRow {
  id: number
  username: string
  realName: string
  role: '管理员' | '运营' | '客服' | '财务'
  dept: string
  email: string
  enabled: boolean
  lastLogin: string
}

const DEPTS = ['技术部', '运营部', '客服部', '财务部', '市场部'] as const
const ROLES = ['管理员', '运营', '客服', '财务'] as const

export const USERS: UserRow[] = Array.from({ length: 46 }, (_, i) => ({
  id: i + 1,
  username: `user${String(i + 1).padStart(3, '0')}`,
  realName: `${pick(SURNAMES)}${pick(GIVEN)}`,
  role: pick(ROLES),
  dept: pick(DEPTS),
  email: `user${i + 1}@example.com`,
  enabled: rand() > 0.15,
  lastLogin: new Date(2026, 9, between(1, 22), between(8, 23), between(0, 59)).toISOString(),
}))

export async function fetchUsers(params: TableRequestParams): Promise<TableResponse<UserRow>> {
  await delay(params.signal, 120, 200)

  const { keyword, role, enabled } = params.params as {
    keyword?: string
    role?: string
    // 查询表单的 select 只能产出 string | number，所以这里是字符串
    enabled?: string
  }

  let rows = USERS.slice()
  if (keyword) {
    const kw = String(keyword).toLowerCase()
    rows = rows.filter((u) => u.username.includes(kw) || u.realName.includes(kw) || u.email.includes(kw))
  }
  if (role) rows = rows.filter((u) => u.role === role)
  if (enabled) {
    // 查询值是 'true' / 'false'，数据是布尔
    rows = rows.filter((u) => String(u.enabled) === enabled)
  }

  if (params.sort?.order) {
    const { field, order } = params.sort
    rows.sort((a, b) => {
      const av = (a as any)[field]
      const bv = (b as any)[field]
      if (av === bv) return 0
      const result = av > bv ? 1 : -1
      return order === 'desc' ? -result : result
    })
  }

  const start = (params.page - 1) * params.pageSize
  return { list: rows.slice(start, start + params.pageSize), total: rows.length }
}

export async function toggleUser(id: number, enabled: boolean): Promise<void> {
  await delay(undefined, 80, 120)
  const user = USERS.find((u) => u.id === id)
  if (user) user.enabled = enabled
}

// ---------- 工作台统计 ----------

export interface DashboardStats {
  totalSales: number
  orderCount: number
  avgOrderValue: number
  refundRate: number
  salesTrend: { categories: string[]; series: Array<{ name: string; data: number[] }> }
  channelShare: Array<{ name: string; value: number }>
  regionRank: Array<{ name: string; value: number }>
  recentOrders: OrderRow[]
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardStats> {
  await delay(signal, 200, 250)

  const completed = ORDERS.filter((o) => o.status === 'completed' || o.status === 'shipped')
  const totalSales = completed.reduce((s, o) => s + o.amount, 0)
  const refunded = ORDERS.filter((o) => o.status === 'refunded').length

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const rand2 = makeRandom(999)

  return {
    totalSales: Math.round(totalSales),
    orderCount: ORDERS.length,
    avgOrderValue: completed.length ? totalSales / completed.length : 0,
    refundRate: ORDERS.length ? (refunded / ORDERS.length) * 100 : 0,
    salesTrend: {
      categories: days,
      series: [
        { name: '销售额', data: days.map(() => between(42000, 98000)) },
        { name: '订单数', data: days.map(() => between(120, 460)) },
      ],
    },
    channelShare: CHANNELS.map((name) => ({
      name,
      value: ORDERS.filter((o) => o.channel === name).reduce((s, o) => s + o.amount, 0) / 1000,
    })).map((x) => ({ ...x, value: Math.round(x.value) + Math.round(rand2() * 500) })),
    regionRank: CITIES.slice(0, 6)
      .map((name) => ({ name, value: between(12, 48) + between(0, 9) / 10 }))
      .sort((a, b) => b.value - a.value),
    recentOrders: ORDERS.slice(0, 6),
  }
}
