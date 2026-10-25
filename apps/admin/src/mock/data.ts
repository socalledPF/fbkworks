/**
 * 业务数据访问层。
 *
 * **这是 `@fbk/data` 契约层的真实用法。**
 *
 * 对比改造前，每个 `fetchXxx` 都要手写：解析筛选字段、排序逻辑、
 * 分页切片、组装 { list, total }。现在只剩「数据从哪来」+「字段在哪」。
 *
 * 注意：本文件不含任何 mock 后端逻辑 —— 那些在 server.ts 里，
 * 真实项目中对应的是 HTTP 请求。
 */

import { defineBackend, type PageFetcher } from '@fbk/data'
import type { Status } from '@fbk/adapter-core'
import { between, delay, makeRandom, mockServerQuery, pick, rand } from './server'

// ---------- 订单 ----------

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded'

export const ORDER_STATUS_MAP: Record<OrderStatus, { text: string; status: Status }> = {
  pending: { text: '待支付', status: 'warning' },
  paid: { text: '已支付', status: 'info' },
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
  const paid =
    status === 'pending' || status === 'cancelled'
      ? null
      : new Date(created.getTime() + between(1, 120) * 60000)

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

/**
 * mock 后端的响应惯例 —— **全项目唯一一处**。
 *
 * 真实项目里这一段对应「你的 Spring / ruoyi 后端长什么样」：
 *   request     怎么发请求
 *   rows/total  列表与总数在哪
 *   isSuccess   业务码怎么判（本例的 mock 没有业务码，所以不传）
 *
 * 定义一次之后，每个接口只写自己的 URL 和 feature。
 * 对比改造前：每个 fetchXxx 都要重复 6 行相同配置。
 */
export const api = defineBackend<{ rows: unknown[]; total: number }>({
  /* A 形态的基础：传输层。
     真实项目里这里是 http.get(url, { params, signal })。

     mock 的特别之处：不同接口对应不同内存表与不同筛选字段，
     所以这里按 url 分派。真实后端由后端自己区分，不需要这一步。 */
  request: (url, params, signal) => {
    const query = {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort ?? null,
      params: params.filters ?? {},
      signal,
    }

    if (url.includes('user')) {
      return mockServerQuery(USERS, query, {
        searchFields: ['username', 'realName', 'email'],
        equals: ['role', 'enabled'],
      })
    }

    return mockServerQuery(ORDERS, query, {
      searchFields: ['orderNo', 'customer', 'phone'],
      equals: ['status', 'channel'],
    })
  },

  rows: 'rows',
  total: 'total',
  scope: 'server-filtered',

  /* 把筛选条件收进 filters，其余分页字段留在顶层。
     真实 Spring 项目通常不需要这么绕 —— 直接摊平即可。 */
  mapParams: ({ page, pageSize, sort, params }) => ({
    page,
    pageSize,
    sort,
    filters: params,
  }),
})

/** 订单列表。只剩「它是哪个接口」这一条信息。 */
export const fetchOrders: PageFetcher<OrderRow> = api.page('/api/order/list', {
  feature: 'order.list',
})

// ---------- 订单详情 ----------

export async function fetchOrder(id: number, signal?: AbortSignal): Promise<OrderRow | null> {
  await delay(signal, 100, 150)
  return ORDERS.find((o) => o.id === id) ?? null
}

export async function deleteOrders(ids: number[], signal?: AbortSignal): Promise<number> {
  await delay(signal, 200, 200)
  for (const id of ids) {
    const idx = ORDERS.findIndex((o) => o.id === id)
    if (idx >= 0) ORDERS.splice(idx, 1)
  }
  return ids.length
}

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

/**
 * 用户列表。
 *
 * 注意这里用的是 **B 形态**（传 fetcher）——
 * 因为用户表的搜索字段和订单不同，需要把「哪些字段参与搜索」
 * 传给 mock 后端。真实项目里如果所有列表参数名一致，用 A 形态即可。
 */
export const fetchUsers: PageFetcher<UserRow> = api.page(
  (query) =>
    mockServerQuery(USERS, query, {
      searchFields: ['username', 'realName', 'email'],
      equals: ['role', 'enabled'],
    }),
  { feature: 'user.list' },
)

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
