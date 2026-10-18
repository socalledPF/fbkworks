import { main, sleep } from './cdp.mjs'

const PG = 'http://localhost:5174/'
const DOCS = 'http://localhost:5173/'

const run = await main()
const { goto, evaluate, inject, shot } = run

const files = [
  'design-preview/component-tokens.css',
  'design-preview/component-layer.css',
]

async function setupPlayground(adapter, theme = 'light', demo) {
  await goto(PG)
  await evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')]
    const byLabel = (t) => sel.find(s => s.closest('label')?.textContent.includes(t))
    const a = byLabel('Adapter')
    a.value = ${JSON.stringify(adapter)}
    a.dispatchEvent(new Event('change', { bubbles: true }))
    const t = byLabel('Theme')
    t.value = ${JSON.stringify(theme)}
    t.dispatchEvent(new Event('change', { bubbles: true }))
    ${demo ? `const d = byLabel('Demo'); d.value = ${JSON.stringify(demo)}; d.dispatchEvent(new Event('change', { bubbles: true }))` : ''}
    return a.value + '/' + t.value
  })()`)
  await sleep(1200)
  await inject(files)
  await sleep(400)
}

const report = {}

// ---- 1. element-plus: measure row height / header / tag contrast ----
await setupPlayground('element-plus')
report.element = await evaluate(`(() => {
  const out = {}
  const row = document.querySelector('.el-table__body tr')
  const th = document.querySelector('.el-table th.el-table__cell')
  const td = document.querySelector('.el-table td.el-table__cell')
  const cell = document.querySelector('.el-table .cell')
  const table = document.querySelector('.el-table')
  const wrap = document.querySelector('.fbk-pro-table')
  const toolbar = document.querySelector('.fbk-pro-table__toolbar')
  const tag = document.querySelector('.el-tag')
  const cs = (el) => el ? getComputedStyle(el) : null
  out.rowH = row ? Math.round(row.getBoundingClientRect().height) : null
  out.thH = th ? Math.round(th.getBoundingClientRect().height) : null
  out.tdPad = cs(td)?.padding
  out.cellPad = cs(cell)?.padding
  out.tableRadius = cs(table)?.borderRadius
  out.tableBg = cs(table)?.backgroundColor
  out.thBg = cs(th)?.backgroundColor
  out.wrapRadius = cs(wrap)?.borderRadius
  out.wrapOverflow = cs(wrap)?.overflow
  out.toolbarH = toolbar ? Math.round(toolbar.getBoundingClientRect().height) : null
  out.toolbarDisplay = cs(toolbar)?.display
  out.tagH = tag ? Math.round(tag.getBoundingClientRect().height) : null
  out.tagColor = cs(tag)?.color
  out.tagBg = cs(tag)?.backgroundColor
  out.tagClass = tag?.className ?? null
  out.fontVariant = cs(cell)?.fontVariantNumeric
  return out
})()`)

await shot('design-preview/shots/component-element.png', { full: true })

// ---- 2. naive-ui ----
await setupPlayground('naive-ui')
report.naive = await evaluate(`(() => {
  const out = {}
  const th = document.querySelector('.n-data-table-th')
  const td = document.querySelector('.n-data-table-td')
  const row = document.querySelector('.n-data-table-tr')
  const tag = document.querySelector('.n-tag')
  const cs = (el) => el ? getComputedStyle(el) : null
  out.thBg = cs(th)?.backgroundColor
  out.thColor = cs(th)?.color
  out.tdColor = cs(td)?.color
  out.rowH = row ? Math.round(row.getBoundingClientRect().height) : null
  out.tagH = tag ? Math.round(tag.getBoundingClientRect().height) : null
  out.tagColor = cs(tag)?.color
  out.tagBg = cs(tag)?.backgroundColor
  out.thCount = document.querySelectorAll('.n-data-table-th').length
  return out
})()`)
await shot('design-preview/shots/component-naive.png', { full: true })

// ---- 3. vant ----
await setupPlayground('vant')
report.vant = await evaluate(`(() => {
  const out = {}
  const tag = document.querySelector('.van-tag')
  const card = document.querySelector('.fbk-vant-grid__card')
  const list = document.querySelector('.van-list')
  const cs = (el) => el ? getComputedStyle(el) : null
  out.tagColor = cs(tag)?.color
  out.tagBg = cs(tag)?.backgroundColor
  out.tagClass = tag?.className ?? null
  out.listDisplay = cs(list)?.display
  out.cardCount = document.querySelectorAll('.fbk-vant-grid__card').length
  out.cardH = card ? Math.round(card.getBoundingClientRect().height) : null
  out.cardCursor = cs(card)?.cursor
  out.cardPadding = cs(card)?.padding
  out.overflowX = cs(document.querySelector('.fbk-pro-table'))?.overflowX
  out.dtColor = cs(document.querySelector('.fbk-vant-grid__field dt'))?.color
  return out
})()`)
await shot('design-preview/shots/component-vant.png', { full: true })

// ---- 4. docs page ----
await goto(DOCS + 'components/pro-table.html')
await sleep(1500)
await inject(files)
await sleep(500)
report.docs = await evaluate(`(() => {
  const out = {}
  const preview = document.querySelector('.fbk-demo__preview')
  const table = document.querySelector('.fbk-demo__preview .el-table')
  const col = document.querySelector('.fbk-demo__preview .el-table col')
  const cs = (el) => el ? getComputedStyle(el) : null
  out.previewW = preview ? Math.round(preview.getBoundingClientRect().width) : null
  out.tableW = table ? Math.round(table.getBoundingClientRect().width) : null
  out.colW = col?.getAttribute('width')
  out.overlapOutline = (() => {
    const el = document.querySelector('.fbk-demo')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const aside = document.querySelector('.VPDoc .aside') || document.querySelector('.VPDocAside')
    if (!aside) return 'no-aside'
    const a = aside.getBoundingClientRect()
    return Math.round(r.right - a.left)
  })()
  return out
})()`)

// ---- 5. dark ----
await goto(PG)
await setupPlayground('element-plus', 'dark')
report.dark = await evaluate(`(() => {
  const out = {}
  const table = document.querySelector('.el-table')
  const th = document.querySelector('.el-table th.el-table__cell')
  const cs = (el) => el ? getComputedStyle(el) : null
  out.theme = document.documentElement.getAttribute('data-fbk-theme')
  out.tableBg = cs(table)?.backgroundColor
  out.thBg = cs(th)?.backgroundColor
  out.pageBg = cs(document.body)?.backgroundColor
  out.btnBg = cs(document.querySelector('.el-button--primary'))?.backgroundColor
  out.btnColor = cs(document.querySelector('.el-button--primary'))?.color
  return out
})()`)
await shot('design-preview/shots/component-dark.png', { full: true })

// ---- 6. responsive columns (the bug) ----
await setupPlayground('element-plus', 'light', 'query-form/basic')
report.responsive = await evaluate(`(() => {
  const out = {}
  const grid = document.querySelector('.fbk-query-form__grid')
  if (!grid) return 'no-grid'
  const cols = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length
  out.base = cols()
  out.baseResolved = getComputedStyle(grid).getPropertyValue('--fbk-cols-resolved').trim()

  // 模拟组件传 columns={{ xs: 2, md: 4 }}。base 是 3，
  // 两个断点值都和 base 不同，才能真正区分「解析到了断点值」还是「回退到 base」。
  const root = grid.closest('.fbk-query-form')
  root.style.setProperty('--fbk-cols-xs', '2')
  root.style.setProperty('--fbk-cols-md', '4')
  out.at1440 = cols()
  out.at1440Resolved = getComputedStyle(grid).getPropertyValue('--fbk-cols-resolved').trim()
  return out
})()`)

// 缩小视口验证 xs 分支
await run.cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 500, height: 900, deviceScaleFactor: 1, mobile: false,
})
await sleep(600)
report.responsive.narrow = await evaluate(`(() => {
  const grid = document.querySelector('.fbk-query-form__grid')
  return {
    cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    resolved: getComputedStyle(grid).getPropertyValue('--fbk-cols-resolved').trim(),
  }
})()`)
await run.cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
})

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
run.close()
