/**
 * 用真实 HTTP 验证 createPageRequest 的契约适应性。
 *
 * 为什么需要它（单测覆盖不到什么）：
 *   单测里 fetch 是 stub，返回的是手写对象 —— 永远「形状正确」。
 *   真实后端会给你：
 *     · 字符串数字（total: "128"）
 *     · HTML 错误页而不是 JSON（502 网关）
 *     · 空 body
 *     · total 为 null
 *     · 字段名和你以为的不一样
 *
 * 这个脚本用**真 fetch 打真 HTTP 服务**，验证契约在这些情况下
 * 要么正确工作，要么给出可排查的错误。
 *
 * 前置：先启动 mock 后端
 *   node scripts/dev/mock-backend.mjs 5199
 *
 * 运行：
 *   node scripts/dev/verify-data-contract.mjs 5199
 */

/*
 * 测**构建产物**而不是源码。
 *
 * 两个理由：
 *   1. 业务方拿到的就是 dist —— 测它才是测真实交付物
 *   2. TS 源码里的相对导入不带扩展名，Node 直接跑不了
 *
 * 前置：先 pnpm --filter @fbkworks/data build
 */
import { FbkDataError, createPageRequest, defineBackend } from '../../packages/data/dist/index.mjs'

const PORT = Number(process.argv[2] ?? 5199)
const BASE = `http://localhost:${PORT}`

let passed = 0
let failed = 0
const failures = []

function check(name, cond, detail) {
  if (cond) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    failures.push({ name, detail })
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** 真 fetch 包装：把 URL 拼上 query */
function http(url, signal) {
  return fetch(`${BASE}${url}`, { signal })
}

const query = (extra = {}) => ({
  page: 1,
  pageSize: 10,
  sort: null,
  params: {},
  signal: new AbortController().signal,
  ...extra,
})

/* ══════════════════════════════════════════════════════════
   1. ruoyi：业务码 + rows/total
   ══════════════════════════════════════════════════════════ */
async function testRuoyi() {
  console.log('\n[1] ruoyi 风格 { code, msg, rows, total }')

  const fetchOrders = createPageRequest({
    fetch: ({ page, pageSize, signal }) =>
      http(`/ruoyi/list?pageNum=${page}&pageSize=${pageSize}`, signal).then((r) => r.json()),
    rows: 'rows',
    total: 'total',
    isSuccess: (res) => res.code === 200,
    errorMessage: (res) => res.msg,
  })

  const result = await fetchOrders(query())
  check('列表长度正确', result.list.length === 10, `实际 ${result.list.length}`)
  check('总数正确', result.total === 128, `实际 ${result.total}`)
  check('行是对象而非被错误转换', typeof result.list[0] === 'object')

  // 翻页拿到不同数据
  const page2 = await fetchOrders(query({ page: 2 }))
  check('第 2 页 id 不同', page2.list[0].id !== result.list[0].id,
    `p1=${result.list[0].id} p2=${page2.list[0].id}`)
  check('第 2 页起始 id = 11', page2.list[0].id === 11, `实际 ${page2.list[0].id}`)
}

/* ══════════════════════════════════════════════════════════
   2. ruoyi 业务失败
   ══════════════════════════════════════════════════════════ */
async function testBusinessError() {
  console.log('\n[2] 业务码失败（code: 401）')

  const captured = []
  const fetchOrders = createPageRequest({
    fetch: ({ page, pageSize, signal }) =>
      http(`/ruoyi/error?pageNum=${page}&pageSize=${pageSize}`, signal).then((r) => r.json()),
    rows: 'rows',
    total: 'total',
    isSuccess: (res) => res.code === 200,
    errorMessage: (res) => res.msg,
    feature: 'order.list',
    onError: (e) => captured.push(e),
  })

  let error = null
  try {
    await fetchOrders(query())
  } catch (e) {
    error = e
  }

  check('抛出 FbkDataError', error instanceof FbkDataError, error?.constructor?.name)
  check('kind 为 business', error?.kind === 'business', error?.kind)
  check('消息是后端原文', error?.message === '登录状态已过期，请重新登录', error?.message)
  check('不被当成空列表', !(error === null))
  check('onError 收到事件', captured.length === 1, `实际 ${captured.length}`)
  check('事件带 feature', captured[0]?.feature === 'order.list', captured[0]?.feature)
  check('事件带原始响应', captured[0]?.raw?.code === 401)
}

/* ══════════════════════════════════════════════════════════
   3. Spring Data
   ══════════════════════════════════════════════════════════ */
async function testSpring() {
  console.log('\n[3] Spring Data { content, totalElements }')

  const fetchList = createPageRequest({
    fetch: ({ page, pageSize, signal }) =>
      http(`/spring/list?page=${page}&pageSize=${pageSize}`, signal).then((r) => r.json()),
    rows: 'content',
    total: 'totalElements',
  })

  const result = await fetchList(query())
  check('列表长度正确', result.list.length === 10, `实际 ${result.list.length}`)
  check('总数正确', result.total === 128, `实际 ${result.total}`)
}

/* ══════════════════════════════════════════════════════════
   4. 三层嵌套
   ══════════════════════════════════════════════════════════ */
async function testNested() {
  console.log('\n[4] 三层嵌套 { data: { records, page: { total } } }')

  const fetchList = createPageRequest({
    fetch: ({ page, pageSize, signal }) =>
      http(`/nested/list?page=${page}&pageSize=${pageSize}`, signal).then((r) => r.json()),
    rows: 'data.records',
    total: 'data.page.total',
  })

  const result = await fetchList(query())
  check('深层路径取到列表', result.list.length === 10, `实际 ${result.list.length}`)
  check('深层路径取到总数', result.total === 128, `实际 ${result.total}`)
}

/* ══════════════════════════════════════════════════════════
   5. 数组包裹（数组下标路径）
   ══════════════════════════════════════════════════════════ */
async function testArrayWrapped() {
  console.log('\n[5] 数组包裹 { data: [{ items, count }] }')

  const fetchList = createPageRequest({
    fetch: ({ page, pageSize, signal }) =>
      http(`/array/list?page=${page}&pageSize=${pageSize}`, signal).then((r) => r.json()),
    rows: 'data.0.items',
    total: 'data.0.count',
  })

  const result = await fetchList(query())
  check('数组下标路径取到列表', result.list.length === 10, `实际 ${result.list.length}`)
  check('数组下标路径取到总数', result.total === 128, `实际 ${result.total}`)
}

/* ══════════════════════════════════════════════════════════
   6. 裸数组
   ══════════════════════════════════════════════════════════ */
async function testBareArray() {
  console.log('\n[6] 裸数组（无分页信息）')

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bare/list`, signal).then((r) => r.json()),
    rows: (raw) => raw,
  })

  const result = await fetchList(query())
  check('整个响应就是列表', Array.isArray(result.list))
  check('total 回退为 list.length', result.total === result.list.length,
    `total=${result.total} len=${result.list.length}`)
}

/* ══════════════════════════════════════════════════════════
   7. 字符串数字
   ══════════════════════════════════════════════════════════ */
async function testStringTotal() {
  console.log('\n[7] 字符串数字 { total: "128" }')

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/string/list`, signal).then((r) => r.json()),
    rows: 'rows',
    total: 'total',
  })

  const result = await fetchList(query())
  check('字符串 total 被转成数字', result.total === 128, `实际 ${typeof result.total} ${result.total}`)
}

/* ══════════════════════════════════════════════════════════
   8. HTML 错误页（502 网关）
   ══════════════════════════════════════════════════════════ */
async function testHtmlError() {
  console.log('\n[8] 502 返回 HTML 而非 JSON')

  const captured = []
  /* 关键：这里的 fetch 直接 res.json()，遇到 HTML 会抛 SyntaxError。
     真实项目里 axios 也会抛。契约层要能把这个错误透传并上报。 */
  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bad/html`, signal).then((r) => r.json()),
    rows: 'rows',
    feature: 'order.list',
    onError: (e) => captured.push(e),
  })

  let error = null
  try {
    await fetchList(query())
  } catch (e) {
    error = e
  }

  check('抛出错误（不静默）', error !== null)
  check('错误被上报', captured.length === 1, `实际 ${captured.length}`)
  check('事件带 feature', captured[0]?.feature === 'order.list')
  console.log(`       错误信息：${error?.message?.slice(0, 60)}`)
}

/* ══════════════════════════════════════════════════════════
   9. 空 body
   ══════════════════════════════════════════════════════════ */
async function testEmptyBody() {
  console.log('\n[9] 空 body（200 但无内容）')

  const captured = []
  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bad/empty`, signal).then((r) => r.json()),
    rows: 'rows',
    onError: (e) => captured.push(e),
  })

  let error = null
  try {
    await fetchList(query())
  } catch (e) {
    error = e
  }

  check('抛出错误而不是返回空列表', error !== null)
  check('错误被上报', captured.length === 1)
}

/* ══════════════════════════════════════════════════════════
   10. total 为 null
   ══════════════════════════════════════════════════════════ */
async function testNullTotal() {
  console.log('\n[10] total 为 null')

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bad/null-total`, signal).then((r) => r.json()),
    rows: 'rows',
    total: 'total',
  })

  let error = null
  try {
    await fetchList(query())
  } catch (e) {
    error = e
  }

  /* 必须抛错，不能静默当成 0。
     Number(null) === 0 —— 如果静默转换，分页器显示「共 0 条」，
     而实际可能有数据。用户看到的是错误信息，且没有任何报错。 */
  check('total 为 null 时抛错（不静默当成 0）', error instanceof FbkDataError,
    error ? undefined : '实际未抛错 —— 会被当成 total=0')
  check('错误信息解释了原因', error?.message?.includes('Number(null) === 0'),
    error?.message?.slice(0, 50))
  check('错误信息给出替代方案', error?.message?.includes('rows.length'))
}

/* ══════════════════════════════════════════════════════════
   11. 字段名不存在
   ══════════════════════════════════════════════════════════ */
async function testMissingField() {
  console.log('\n[11] 字段名写错（rows vs records）')

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bad/missing-rows`, signal).then((r) => r.json()),
    rows: 'rows', // 后端实际返回的是 records
    total: 'total',
  })

  let error = null
  try {
    await fetchList(query())
  } catch (e) {
    error = e
  }

  check('抛出 FbkDataError', error instanceof FbkDataError)
  check('kind 为 path', error?.kind === 'path', error?.kind)
  check('错误信息含实际响应片段', error?.message?.includes('records'),
    error?.message?.includes('records') ? '含' : '不含 —— 排查会很难')
}

/* ══════════════════════════════════════════════════════════
   12. AbortSignal
   ══════════════════════════════════════════════════════════ */
async function testAbort() {
  console.log('\n[12] AbortSignal 取消')

  const captured = []
  const controller = new AbortController()

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/bad/slow`, signal).then((r) => r.json()),
    rows: 'rows',
    onError: (e) => captured.push(e),
  })

  const promise = fetchList(query({ signal: controller.signal }))
  setTimeout(() => controller.abort(), 100)

  let error = null
  try {
    await promise
  } catch (e) {
    error = e
  }

  check('取消时抛错', error !== null)
  check('错误是 AbortError', error?.name === 'AbortError', error?.name)
  /* 关键：取消**不该**上报 —— 否则快速翻页时每页都产生一条噪音 */
  check('取消不上报（避免监控噪音）', captured.length === 0, `实际上报 ${captured.length} 条`)
}

/* ══════════════════════════════════════════════════════════
   13. mapRow 转换
   ══════════════════════════════════════════════════════════ */
async function testMapRow() {
  console.log('\n[13] mapRow 行映射（下划线转驼峰）')

  const fetchList = createPageRequest({
    fetch: ({ signal }) => http(`/ruoyi/list`, signal).then((r) => r.json()),
    rows: 'rows',
    total: 'total',
    mapRow: (raw) => ({
      id: raw.id,
      orderNo: raw.order_no,
      customer: raw.customer_name,
      amount: raw.amount,
      status: raw.status,
      createdAt: raw.created_at,
    }),
  })

  const result = await fetchList(query())
  check('映射后可访问驼峰字段', result.list[0].orderNo?.startsWith('SO2026'),
    result.list[0].orderNo)
  check('原始下划线字段不再存在', result.list[0].order_no === undefined)
}

/* ══════════════════════════════════════════════════════════
   14. defineBackend：后端惯例复用（A 形态）
   ══════════════════════════════════════════════════════════ */
async function testDefineBackendA() {
  console.log('\n[14] defineBackend A 形态（传路径）')

  /* 模拟真实项目：全项目唯一一处描述 Spring 后端 */
  const api = defineBackend({
    request: (url, params, signal) => {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString()
      return http(`${url}?${qs}`, signal).then((r) => r.json())
    },
    rows: 'content',
    total: 'totalElements',
    /* 注意：真实 Spring Data 的 page 是 0 基，但 mock 后端按 1 基实现。
       这里改用 pageNum（也是常见惯例），避免测试依赖 mock 的基址选择 ——
       我们验证的是「mapParams 能改参数名」，不是「mock 后端的基址对不对」。 */
    mapParams: ({ page, pageSize, params }) => ({
      pageNum: page,
      pageSize,
      ...params,
    }),
  })

  // 每个接口只写自己的信息
  const fetchOrders = api.page('/spring/list', { feature: 'order.list' })
  const fetchUsers = api.page('/spring/list', { feature: 'user.list' })

  const orders = await fetchOrders(query({ page: 1 }))
  check('A 形态解析列表', orders.list.length === 10, `实际 ${orders.list.length}`)
  check('A 形态解析总数', orders.total === 128, `实际 ${orders.total}`)

  const users = await fetchUsers(query({ page: 1 }))
  check('第二个接口复用同一份配置', users.total === 128)

  /* 验证 mapParams 生效：它能改变参数名（page → pageNum），
     并传对分页值。mock 后端两种写法都认，所以这里能验证到真实效果。 */
  const page2 = await fetchOrders(query({ page: 2 }))
  check('mapParams 生效（page=2 拿到第 2 页）', page2.list[0].id === 11,
    `实际 id=${page2.list[0].id}`)
}

/* ══════════════════════════════════════════════════════════
   15. defineBackend：B 形态（逃生口）
   ══════════════════════════════════════════════════════════ */
async function testDefineBackendB() {
  console.log('\n[15] defineBackend B 形态（传 fetcher）')

  const api = defineBackend({
    // 不会被调用 —— B 形态绕过它
    request: () => {
      throw new Error('B 形态不该走 request')
    },
    rows: 'content',
    total: 'totalElements',
  })

  // 逃生口：URL 需要特殊拼接，参数名也不同
  const fetchSpecial = api.page(({ page, pageSize, signal }) =>
    http(`/spring/list?page=${page - 1}&size=${pageSize}`, signal).then((r) => r.json()),
  )

  const result = await fetchSpecial(query({ page: 1 }))
  check('B 形态能自己发请求', result.list.length === 10, `实际 ${result.list.length}`)
  check('B 形态仍用后端配置解析', result.total === 128, `实际 ${result.total}`)
}

/* ══════════════════════════════════════════════════════════
   16. defineBackend：接口级覆盖
   ══════════════════════════════════════════════════════════ */
async function testDefineBackendOverride() {
  console.log('\n[16] defineBackend 接口级覆盖')

  const api = defineBackend({
    request: (url, params, signal) => {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString()
      return http(`${url}?${qs}`, signal).then((r) => r.json())
    },
    // 后端惯例是 Spring
    rows: 'content',
    total: 'totalElements',
    isSuccess: (res) => res.code === 200,
    errorMessage: (res) => res.msg,
  })

  // 但这个老接口是 ruoyi 风格
  const fetchLegacy = api.page('/ruoyi/list', {
    rows: 'rows',
    total: 'total',
    isSuccess: (res) => res.code === 200,
  })

  const result = await fetchLegacy(query())
  check('覆盖 rows/total 后正确解析', result.list.length === 10, `实际 ${result.list.length}`)
  check('覆盖后总数正确', result.total === 128)
}

/* ══════════════════════════════════════════════════════════
   主流程
   ══════════════════════════════════════════════════════════ */
async function main() {
  // 先确认服务活着
  try {
    const res = await fetch(`${BASE}/health`)
    if (!res.ok) throw new Error('health 返回非 200')
  } catch {
    console.error(
      `[verify] 无法连接 mock 后端 ${BASE}\n` +
        `  请先启动：node scripts/dev/mock-backend.mjs ${PORT}`,
    )
    process.exit(1)
  }

  console.log(`\n用真实 HTTP 验证 createPageRequest（${BASE}）`)
  console.log('═'.repeat(56))

  for (const test of [
    testRuoyi,
    testBusinessError,
    testSpring,
    testNested,
    testArrayWrapped,
    testBareArray,
    testStringTotal,
    testHtmlError,
    testEmptyBody,
    testNullTotal,
    testMissingField,
    testAbort,
    testMapRow,
    testDefineBackendA,
    testDefineBackendB,
    testDefineBackendOverride,
  ]) {
    try {
      await test()
    } catch (err) {
      failed++
      failures.push({ name: test.name, detail: err.message })
      console.log(`  FAIL ${test.name} 抛异常：${err.message}`)
    }
  }

  console.log('\n' + '═'.repeat(56))
  console.log(`通过 ${passed} / ${passed + failed}`)

  if (failed > 0) {
    console.log('\n失败项：')
    for (const f of failures) console.log(`  · ${f.name} — ${f.detail}`)
    process.exit(1)
  }
}

main()
