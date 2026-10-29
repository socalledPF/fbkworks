/**
 * 业务数据访问层。
 *
 * **这是 `@fbkworks/data` 契约层的真实用法。**
 *
 * 对比改造前，每个 `fetchXxx` 都要手写：解析筛选字段、排序逻辑、
 * 分页切片、组装 { list, total }。现在只剩「数据从哪来」+「字段在哪」。
 *
 * 注意：本文件不含任何 mock 后端逻辑 —— 那些在 server.ts 里，
 * 真实项目中对应的是 HTTP 请求。
 */

import { defineBackend, type PageFetcher, type PageQuery } from '@fbkworks/data'
import type { Status } from '@fbkworks/adapter-core'
import {
  between,
  delay,
  makeRandom,
  mockRoute,
  mockServerQuery,
  pick,
  rand,
  registerMockTable,
} from './server'

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
 * 这一段对应真实项目里的：
 *
 * ```ts
 * export const api = defineBackend({
 *   request: (url, params, signal) => http.get(url, { params, signal }).then((r) => r.data),
 *   rows: 'content',
 *   total: 'totalElements',
 *   isSuccess: (res) => res.code === 200,
 *   errorMessage: (res) => res.msg,
 *   scope: 'server-filtered',
 *   mapParams: ({ page, pageSize, params }) => ({ pageNum: page, pageSize, ...params }),
 * })
 * ```
 *
 * 本 demo 用一个内存 mock 代替 HTTP，所以 `request` 里有两处
 * **mock 特有的权宜**（真实项目不需要）：
 *
 *   1. 按 url 分派到不同的内存表 —— 真实后端天然按 URL 路由
 *   2. 用 mapParams 把筛选条件收进 filters —— 只是为了让 mockServerQuery
 *      能区分「分页字段」和「筛选条件」；真实后端通常是摊平的
 *
 * 这两处不该被当成 defineBackend 的常规用法。
 */
export const api = defineBackend<{ rows: unknown[]; total: number }>({
  // mock 权宜 1：真实项目这里是 http.get(url, { params, signal })
  request: (url, params, signal) =>
    mockRoute(url, {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort ?? null,
      params: params.filters ?? {},
      signal,
    }),

  rows: 'rows',
  total: 'total',
  scope: 'server-filtered',

  // mock 权宜 2：真实项目通常是 ({ page, pageSize, ...params }) => ({ pageNum: page, pageSize, ...params })
  mapParams: ({ page, pageSize, sort, params }) => ({
    page,
    pageSize,
    sort,
    filters: params,
  }),
})

/* 注册 mock 表。真实项目里没有这段 —— 后端天然按 URL 路由。 */
registerMockTable('order', (query: PageQuery) =>
  mockServerQuery(ORDERS, query, {
    searchFields: ['orderNo', 'customer', 'phone'],
    equals: ['status', 'channel'],
  }),
)
registerMockTable('user', (query: PageQuery) =>
  mockServerQuery(USERS, query, {
    searchFields: ['username', 'realName', 'email'],
    equals: ['role', 'enabled'],
  }),
)

/**
 * 两个列表接口。
 *
 * **只剩「它是哪个接口」这一条信息** —— 这就是 defineBackend 的价值：
 * 后端惯例（rows/total/scope/错误处理）在 12 个接口里只写一次。
 *
 * 注意：价值不在「省了 6 行」，而在**可审计性**——
 * 后端把 total 字段改名时，只改上面一处；某个接口漏了
 * scope 声明时，这里不可能漏。
 */
export const fetchOrders: PageFetcher<OrderRow> = api.page('/api/order/list', {
  feature: 'order.list',
})

export const fetchUsers: PageFetcher<UserRow> = api.page('/api/user/list', {
  feature: 'user.list',
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
