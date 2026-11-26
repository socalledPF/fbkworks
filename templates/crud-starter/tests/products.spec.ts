import { describe, expect, it } from 'vitest'
import type { PageQuery as _PageQuery } from '@fbkworks/data'
import {
  formFields,
  productFields,
  queryFields,
  toTableColumns,
} from '../src/product-fields'
import {
  fetchProduct,
  fetchProducts,
  peekProducts,
  PRODUCT_STATUS_MAP,
  saveProduct,
} from '../src/product-api'

/**
 * 模板的冒烟测试。它**跑在仓库根的 vitest 里**（vitest.config.ts 的 include
 * 覆盖 templates/**\/tests/**），所以 `pnpm test` / `pnpm verify` 一条命令就会跑到它 ——
 * 不像 apps/admin 的用例要靠 --config 单独跑，那种写法最后一定会烂掉。
 *
 * 覆盖两件事，正好是模板最容易烂掉的两处：
 *   1. 一份定义真的派生出三份视图（删掉 views 过滤、或三处各写一遍，这里都会红）
 *   2. mock 后端真的按 PageQuery 分页/筛选/排序（否则页面「有分页」只是有翻页按钮）
 */

const query = (overrides: Partial<_PageQuery> = {}): _PageQuery => ({
  page: 1,
  pageSize: 10,
  sort: null,
  params: {},
  signal: new AbortController().signal,
  ...overrides,
})

describe('一份定义派生三份视图', () => {
  it('三个视图都来自同一份定义，且各自的条数少于定义总数（views 过滤真的生效）', () => {
    expect(productFields).toHaveLength(9)
    const columns = toTableColumns()
    // 每份视图都比定义少 —— 说明「这个字段只出现在哪些视图」被真的执行了
    expect(queryFields.length).toBeLessThan(productFields.length)
    expect(columns.length).toBeLessThan(productFields.length)
    expect(formFields.length).toBeLessThan(productFields.length)
  })

  it('三个视图各自拿到该有的字段，不互相串台', () => {
    const queryNames = queryFields.map((f) => f.name)
    const columnNames = toTableColumns().map((c) => c.key)
    const formNames = formFields.map((f) => f.name)

    // keyword 只用来收集查询词，不是数据字段
    expect(queryNames).toContain('keyword')
    expect(columnNames).not.toContain('keyword')
    expect(formNames).not.toContain('keyword')

    // createdAt 只在表格里
    expect(columnNames).toContain('createdAt')
    expect(queryNames).not.toContain('createdAt')
    expect(formNames).not.toContain('createdAt')

    // remark 只在表单里
    expect(formNames).toContain('remark')
    expect(queryNames).not.toContain('remark')
    expect(columnNames).not.toContain('remark')
  })

  it('表格列带上了 ProTable 需要的 key / title / dataIndex，配置也从定义里来', () => {
    const status = toTableColumns().find((c) => c.key === 'status')!
    expect(status.title).toBe('状态')
    expect(status.dataIndex).toBe('status')
    expect(status.valueType).toBe('enum')
    // valueEnum 的文案与数据层同一份映射（不是表格里再抄一遍中文）
    const valueEnum = status.valueEnum as Record<string, { text: string }>
    expect(valueEnum.on!.text).toBe(PRODUCT_STATUS_MAP.on.text)
    // 列的显示配置（宽度/对齐）来自字段定义的 column 段
    const price = toTableColumns().find((c) => c.key === 'price')!
    expect(price.align).toBe('right')
    expect(price.sortable).toBe(true)
  })

  it('派生没有丢字段：定义里属于 column 视图的字段，表格列一个不少', () => {
    const expected = productFields.filter((f) => (f.views ?? ['query', 'column', 'form']).includes('column'))
    expect(toTableColumns().map((c) => c.key)).toEqual(expected.map((f) => f.name))
  })
})

describe('mock 后端按 PageQuery 分页 / 筛选 / 排序', () => {
  it('第一页返回 pageSize 条，total 是整表条数（不是本页条数）', async () => {
    const page = await fetchProducts(query())
    expect(page.list).toHaveLength(10)
    expect(page.total).toBe(peekProducts().length)
    expect(page.total).toBeGreaterThan(10)
  })

  it('翻页拿到的是不同的行（不是把第一页又发一遍）', async () => {
    const first = await fetchProducts(query({ page: 1 }))
    const second = await fetchProducts(query({ page: 2 }))
    const overlap = second.list.filter((row) => first.list.some((x) => x.id === row.id))
    expect(overlap).toHaveLength(0)
  })

  it('最后一页是不满的一页 —— 63 条 / 每页 10 条时尾页 3 条', async () => {
    const total = peekProducts().length
    const pageSize = 10
    const lastPage = Math.ceil(total / pageSize)
    const page = await fetchProducts(query({ page: lastPage, pageSize }))
    expect(page.list).toHaveLength(total - (lastPage - 1) * pageSize)
    expect(total % pageSize).not.toBe(0)
  })

  it('筛选条件按字段名等值过滤，total 随之变小', async () => {
    const all = await fetchProducts(query({ pageSize: 100 }))
    const filtered = await fetchProducts(query({ pageSize: 100, params: { status: 'on' } }))
    expect(filtered.total).toBeLessThan(all.total)
    expect(filtered.total).toBe(peekProducts().filter((row) => row.status === 'on').length)
    expect(filtered.list.every((row) => row.status === 'on')).toBe(true)
  })

  it('排序按 sort.field / sort.order 真的重排了', async () => {
    const desc = await fetchProducts(
      query({ pageSize: 100, sort: { field: 'price', order: 'desc' } }),
    )
    const prices = desc.list.map((row) => row.price)
    expect(prices).toEqual([...prices].sort((a, b) => b - a))
  })

  it('关键词在 SKU 与商品名上匹配', async () => {
    const hit = await fetchProducts(query({ pageSize: 100, params: { keyword: 'SKU-0001' } }))
    expect(hit.list.map((row) => row.sku)).toContain('SKU-0001')
    const miss = await fetchProducts(query({ pageSize: 100, params: { keyword: '不存在的商品' } }))
    expect(miss.total).toBe(0)
  })
})

describe('详情与保存（页面上的另一条链路）', () => {
  it('详情返回该行；不存在的 id 返回 null（页面据此渲染 404 而不是空白）', async () => {
    const first = peekProducts()[0]!
    await expect(fetchProduct(first.id)).resolves.toMatchObject({ id: first.id, sku: first.sku })
    await expect(fetchProduct(999999)).resolves.toBeNull()
  })

  it('保存：没有 id 是新增，有 id 是修改 —— FormModal 的 create/edit 两种模式共用它', async () => {
    const before = peekProducts().length
    await saveProduct({ name: '冒烟测试商品', price: 9.9, stock: 1, status: 'on' })
    expect(peekProducts().length).toBe(before + 1)

    const created = peekProducts()[0]!
    expect(created.name).toBe('冒烟测试商品')

    await saveProduct({ id: created.id, name: '冒烟测试商品（已改名）' })
    const edited = peekProducts().find((row) => row.id === created.id)!
    expect(edited.name).toBe('冒烟测试商品（已改名）')
    expect(peekProducts().length).toBe(before + 1)
  })
})
