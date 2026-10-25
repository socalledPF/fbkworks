/**
 * 真实后端模拟服务。
 *
 * 不是一个简单的 mock —— 它用真实 HTTP 返回**真实世界里见过的 7 种响应形状**，
 * 用来验证 createPageRequest 的契约适应性。
 *
 * 每种形状都来自真实项目（不是编的）：
 *   1. ruoyi      { code, msg, rows, total }
 *   2. Spring Data{ content, totalElements, number, size }
 *   3. 嵌套包装   { data: { records, page: { total } } }
 *   4. 数组包裹   { data: [{ items, count }] }
 *   5. 裸数组     [{...}]
 *   6. 字符串数字 { rows, total: "128" }
 *   7. 异常响应   HTML 错误页 / 空 body / total 为 null
 *
 * 用法：node scripts/dev/mock-backend.mjs [port]
 */

import { createServer } from 'node:http'

const PORT = Number(process.argv[2] ?? 5199)

/** 造 N 条订单 */
function makeRows(count, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i + 1,
    order_no: `SO2026${String(offset + i + 1).padStart(6, '0')}`,
    customer_name: ['张三', '李四', '王五', '赵六'][(offset + i) % 4],
    amount: 100 + ((offset + i) * 37) % 900,
    status: ['pending', 'paid', 'completed'][(offset + i) % 3],
    created_at: '2026-10-25T10:00:00Z',
  }))
}

/** 从 query 取分页参数，兼容 pageNum/page 两种写法 */
function pageParams(url) {
  const q = url.searchParams
  const page = Number(q.get('pageNum') ?? q.get('page') ?? 1)
  const size = Number(q.get('pageSize') ?? q.get('size') ?? 10)
  return { page: Math.max(1, page), size: Math.max(1, Math.min(100, size)) }
}

const TOTAL = 128

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const { page, size } = pageParams(url)
  const start = (page - 1) * size
  // 按请求的 page 造不同 id，便于验证「翻页真的拿到了不同数据」
  const rows = makeRows(Math.min(size, Math.max(0, TOTAL - start)), start)

  const json = (body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  switch (url.pathname) {
    /* ---------- 1. ruoyi 风格：业务码 + rows/total ---------- */
    case '/ruoyi/list':
      // 模拟慢响应，用来测 AbortSignal
      setTimeout(() => json({ code: 200, msg: '查询成功', rows, total: TOTAL }), 80)
      return

    /* ---------- 2. ruoyi 业务失败：code !== 200 ---------- */
    case '/ruoyi/error':
      json({ code: 401, msg: '登录状态已过期，请重新登录', rows: null, total: null })
      return

    /* ---------- 3. Spring Data 风格 ---------- */
    case '/spring/list':
      json({
        content: rows,
        totalElements: TOTAL,
        totalPages: Math.ceil(TOTAL / size),
        number: page - 1,
        size,
        first: page === 1,
        last: start + size >= TOTAL,
      })
      return

    /* ---------- 4. 三层嵌套 ---------- */
    case '/nested/list':
      json({
        status: 'ok',
        data: {
          records: rows,
          page: { total: TOTAL, current: page, size },
        },
      })
      return

    /* ---------- 5. 数组包裹：列表在 data[0] 里 ---------- */
    case '/array/list':
      json({
        data: [{ items: rows, count: TOTAL }],
      })
      return

    /* ---------- 6. 裸数组（无分页信息） ---------- */
    case '/bare/list':
      json(rows)
      return

    /* ---------- 7. 字符串数字 ---------- */
    case '/string/list':
      json({ rows, total: String(TOTAL) })
      return

    /* ---------- 异常场景 ---------- */
    case '/bad/html':
      // 网关错误页：返回 HTML 而不是 JSON
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<html><body><h1>502 Bad Gateway</h1></body></html>')
      return

    case '/bad/empty':
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('')
      return

    case '/bad/null-total':
      json({ rows, total: null })
      return

    case '/bad/missing-rows':
      json({ total: TOTAL, records: rows })
      return

    case '/bad/slow':
      // 5 秒才返回，用于测 AbortSignal
      setTimeout(() => json({ rows, total: TOTAL }), 5000)
      return

    /* ---------- 健康检查 ---------- */
    case '/health':
      json({ ok: true })
      return

    default:
      json({ error: 'not found' }, 404)
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[mock-backend] 端口 ${PORT} 已被占用。\n` +
        `  换一个端口：node scripts/dev/mock-backend.mjs 5200\n` +
        `  或者关掉占用它的进程。`,
    )
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  const actual = server.address().port
  console.log(`[mock-backend] listening on http://localhost:${actual}`)
  console.log('[mock-backend] 端点：')
  for (const p of [
    '/ruoyi/list',
    '/ruoyi/error',
    '/spring/list',
    '/nested/list',
    '/array/list',
    '/bare/list',
    '/string/list',
    '/bad/html',
    '/bad/empty',
    '/bad/null-total',
    '/bad/missing-rows',
  ]) {
    console.log(`  ${p}`)
  }
})
