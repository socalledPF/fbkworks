/**
 * 数据源：**mock 后端**，签名与真实接口完全一致（PageQuery → Page）。
 *
 * 接自己的后端时，这个文件是第 1 处要替换的地方 —— 三个函数各换成一次 HTTP 请求：
 *   · fetchProducts  列表（分页 / 筛选 / 排序）
 *   · fetchProduct   详情（返回 null 表示 404）
 *   · saveProduct    保存（create / edit 同一个入口）
 * 下面的内存表和 delay() 是 mock 的权宜，真实项目里不存在。
 *
 * 为什么返回 PageQuery/Page 而不是自定义参数：分页契约的唯一定义处是 @fbkworks/data，
 * ProTable / CrudPage 的 request prop 就是它的别名（改那边这里跟着变，不会漂移）。
 */

import type { Page, PageQuery } from '@fbkworks/data'

export type ProductStatus = 'on' | 'off' | 'out'

/** 状态的中文名与展示色。表格的 valueEnum、详情页的文案都从这里来，不写第二份。 */
export const PRODUCT_STATUS_MAP: Record<ProductStatus, { text: string; status: 'success' | 'default' | 'warning' }> = {
  on: { text: '在售', status: 'success' },
  off: { text: '已下架', status: 'default' },
  out: { text: '缺货', status: 'warning' },
}

export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS_MAP) as ProductStatus[]).map(
  (value) => ({ label: PRODUCT_STATUS_MAP[value].text, value }),
)

/** ProTable 的 valueEnum：列渲染直接用这张表，不必再写一遍 render */
export const PRODUCT_STATUS_ENUM = Object.fromEntries(
  (Object.keys(PRODUCT_STATUS_MAP) as ProductStatus[]).map((value) => [
    value,
    { text: PRODUCT_STATUS_MAP[value].text, status: PRODUCT_STATUS_MAP[value].status },
  ]),
)

export const PRODUCT_CATEGORIES = ['数码', '家电', '服饰', '食品'] as const
export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((value) => ({ label: value, value }))

export interface ProductRow {
  id: number
  sku: string
  name: string
  category: (typeof PRODUCT_CATEGORIES)[number]
  price: number
  stock: number
  status: ProductStatus
  createdAt: string
  remark: string
}

/* ---------- 以下是 mock 后端的实现，真实项目里整段删掉 ---------- */

/** 确定性伪随机：每次刷新数据一致，截图与断言才不会飘。 */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const rand = makeRandom(20261124)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

const STATUS_LIST: ProductStatus[] = ['on', 'off', 'out']
const NAMES = ['无线耳机', '机械键盘', '空气净化器', '羊毛大衣', '坚果礼盒', '冷暖风扇', '运动水杯', '手冲咖啡壶']

/** 63 条：故意不是 10 的整数倍，分页尾页不是满页 —— 那种边界最容易写错。 */
const PRODUCTS: ProductRow[] = Array.from({ length: 63 }, (_, i) => ({
  id: i + 1,
  sku: `SKU-${String(i + 1).padStart(4, '0')}`,
  name: `${pick(NAMES)} ${pick(['Pro', 'Max', 'Lite', '标准版'])}`,
  category: pick(PRODUCT_CATEGORIES),
  price: between(19, 4999) + between(0, 99) / 100,
  stock: between(0, 500),
  status: pick(STATUS_LIST),
  createdAt: new Date(2026, 9, between(1, 30), between(8, 22), between(0, 59)).toISOString(),
  remark: rand() > 0.7 ? '大客户专供' : '',
}))

/**
 * 模拟网络：给出比真实请求更坏的条件 —— 有延迟、响应 AbortSignal。
 * 组件在快速翻页时会 abort 上一页，这里必须真的 reject，否则测不出竞态。
 */
function delay(signal: AbortSignal, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    })
  })
}

/** 测试环境不要真等，否则每条用例白等 160ms */
const NETWORK_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 160

/** 【替换点 1/3】列表。真实项目里是 http.get('/api/products', query) 后交给 @fbkworks/data 映射 */
export async function fetchProducts(query: PageQuery): Promise<Page<ProductRow>> {
  await delay(query.signal, NETWORK_DELAY_MS)

  const { keyword, ...filters } = query.params as Record<string, any>
  let rows = PRODUCTS.slice()

  // 关键词：真实后端在 SQL 里做；这里等价地做同样的事
  if (keyword) {
    const kw = String(keyword).trim().toLowerCase()
    rows = rows.filter(
      (row) => row.sku.toLowerCase().includes(kw) || row.name.toLowerCase().includes(kw),
    )
  }
  // 等值筛选：查询区字段名与数据字段同名，所以一个循环就够
  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    rows = rows.filter((row) => String((row as Record<string, any>)[field]) === String(value))
  }

  if (query.sort?.order) {
    const { field, order } = query.sort
    rows.sort((a, b) => {
      const av = (a as Record<string, any>)[field]
      const bv = (b as Record<string, any>)[field]
      if (av === bv) return 0
      const result = av > bv ? 1 : -1
      return order === 'desc' ? -result : result
    })
  }

  const start = (query.page - 1) * query.pageSize
  return { list: rows.slice(start, start + query.pageSize), total: rows.length }
}

/** 【替换点 2/3】详情。返回 null 即「不存在」，DetailPage / DetailDrawer 会渲染 404 态 */
export async function fetchProduct(id: number): Promise<ProductRow | null> {
  await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS))
  return PRODUCTS.find((row) => row.id === id) ?? null
}

/** 【替换点 3/3】保存。create / edit 同一个入口：有 id 就是改，没有就是新增 */
export async function saveProduct(values: Partial<ProductRow>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS))
  if (values.id) {
    const index = PRODUCTS.findIndex((row) => row.id === values.id)
    if (index >= 0) PRODUCTS[index] = { ...PRODUCTS[index]!, ...values }
    return
  }
  const nextId = Math.max(0, ...PRODUCTS.map((row) => row.id)) + 1
  PRODUCTS.unshift({
    id: nextId,
    sku: `SKU-${String(nextId).padStart(4, '0')}`,
    name: values.name ?? '未命名商品',
    category: values.category ?? PRODUCT_CATEGORIES[0],
    price: values.price ?? 0,
    stock: values.stock ?? 0,
    status: values.status ?? 'on',
    createdAt: new Date().toISOString(),
    remark: values.remark ?? '',
  })
}

/** 列表的批量删除。不属于「接后端 3 处」，但删完要刷新列表，模板里一并给出 */
export async function deleteProducts(ids: number[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS))
  for (let i = PRODUCTS.length - 1; i >= 0; i -= 1) {
    if (ids.includes(PRODUCTS[i]!.id)) PRODUCTS.splice(i, 1)
  }
}

/** 测试与「重置演示数据」用：拿到内存表本身 */
export function peekProducts(): readonly ProductRow[] {
  return PRODUCTS
}
