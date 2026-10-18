/**
 * 验证**落地后**的真实效果。
 *
 * 和 verify.mjs 的区别：verify.mjs 注入 design-preview 里的样式，
 * 这个脚本不注入任何东西 —— 它测的是仓库源码构建出来的样子。
 */
import { main, sleep } from './cdp.mjs'

const PG = 'http://localhost:5174/'
const run = await main()
const { goto, evaluate, shot } = run

async function setup(adapter, theme = 'light', demo) {
  await goto(PG)
  await evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')]
    const by = (t) => sel.find(s => s.closest('label')?.textContent.includes(t))
    by('Adapter').value = ${JSON.stringify(adapter)}
    by('Adapter').dispatchEvent(new Event('change', { bubbles: true }))
    by('Theme').value = ${JSON.stringify(theme)}
    by('Theme').dispatchEvent(new Event('change', { bubbles: true }))
    ${demo ? `const d = by('Demo'); d.value = ${JSON.stringify(demo)}; d.dispatchEvent(new Event('change', { bubbles: true }))` : ''}
  })()`)
  await sleep(1500)
}

const report = {}

// ---- element-plus 亮色 ----
await setup('element-plus')
report.element = await evaluate(`(() => {
  const q = (s) => document.querySelector(s)
  const cs = (s) => { const e = q(s); return e ? getComputedStyle(e) : null }
  const row = q('.el-table__body tr')
  const th = q('.el-table th.el-table__cell')
  const tag = q('.el-tag')
  const wrap = q('.fbk-pro-table')
  return {
    tableW: Math.round(q('.el-table').getBoundingClientRect().width),
    bodyTableW: Math.round(q('.el-table__body').getBoundingClientRect().width),
    wrapW: Math.round(wrap.getBoundingClientRect().width),
    rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
    thH: th ? Math.round(th.getBoundingClientRect().height) : null,
    thBg: cs('.el-table th.el-table__cell')?.backgroundColor,
    cellPad: cs('.el-table .cell')?.padding,
    toolbar: q('.fbk-pro-table__toolbar') ? 'present' : 'absent',
    tagH: tag ? Math.round(tag.getBoundingClientRect().height) : null,
    tagColor: cs('.el-tag')?.color,
    tagBg: cs('.el-tag')?.backgroundColor,
    tagRadius: cs('.el-tag')?.borderRadius,
    numericCells: document.querySelectorAll('.el-table td.fbk-numeric').length,
    numericFont: cs('.el-table td.fbk-numeric')?.fontVariantNumeric,
    wrapRadius: cs('.fbk-pro-table')?.borderRadius,
    wrapShadow: cs('.fbk-pro-table')?.boxShadow,
  }
})()`)
await shot('design-preview/shots/real-element.png', { full: true })

// ---- 响应式列数（真实组件，不再是注入模拟）----
await setup('element-plus', 'light', 'query-form/basic')
report.responsive = await evaluate(`(() => {
  const grid = document.querySelector('.fbk-query-form__grid')
  if (!grid) return 'no-grid'
  const root = grid.closest('.fbk-query-form')
  const cols = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length
  return {
    defaultCols: cols(),
    base: getComputedStyle(root).getPropertyValue('--fbk-cols-base').trim(),
    resolved: getComputedStyle(grid).getPropertyValue('--fbk-cols-resolved').trim(),
  }
})()`)

// ---- naive ----
await setup('naive-ui')
report.naive = await evaluate(`(() => {
  const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null }
  const tag = document.querySelector('.n-tag')
  return {
    thBg: cs('.n-data-table-th')?.backgroundColor,
    thColor: cs('.n-data-table-th')?.color,
    tdColor: cs('.n-data-table-td')?.color,
    rowH: (() => { const r = document.querySelector('.n-data-table-tr'); return r ? Math.round(r.getBoundingClientRect().height) : null })(),
    tagH: tag ? Math.round(tag.getBoundingClientRect().height) : null,
    tagColor: cs('.n-tag')?.color,
    tagBg: cs('.n-tag')?.backgroundColor,
  }
})()`)
await shot('design-preview/shots/real-naive.png', { full: true })

// ---- vant ----
await setup('vant')
report.vant = await evaluate(`(() => {
  const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null }
  const tag = document.querySelector('.van-tag')
  return {
    cards: document.querySelectorAll('.fbk-vant-grid__card').length,
    cardBg: cs('.fbk-vant-grid__card')?.backgroundColor,
    cardRadius: cs('.fbk-vant-grid__card')?.borderRadius,
    cardCursor: cs('.fbk-vant-grid__card')?.cursor,
    tagColor: cs('.van-tag')?.color,
    tagBg: cs('.van-tag')?.backgroundColor,
    tagH: tag ? Math.round(tag.getBoundingClientRect().height) : null,
    numericFields: document.querySelectorAll('.fbk-vant-grid__field[data-numeric]').length,
  }
})()`)
await shot('design-preview/shots/real-vant.png', { full: true })

// ---- 暗色（走真实主题切换，验证 theme.ts 的修复）----
await setup('element-plus', 'dark')
report.dark = await evaluate(`(() => {
  const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null }
  return {
    theme: document.documentElement.getAttribute('data-fbk-theme'),
    darkClass: document.documentElement.classList.contains('dark'),
    tableBg: cs('.el-table')?.backgroundColor,
    thBg: cs('.el-table th.el-table__cell')?.backgroundColor,
    totalColor: cs('.el-pagination__total')?.color,
    pageColor: cs('.el-pagination .number:not(.is-active)')?.color,
    rowText: cs('.el-table__body td .cell')?.color,
    elTextRegular: getComputedStyle(document.documentElement).getPropertyValue('--el-text-color-regular').trim(),
    elBg: getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim(),
  }
})()`)
await shot('design-preview/shots/real-dark.png', { full: true })

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
run.close()
