import { main, sleep } from './cdp.mjs'

const run = await main()
const { goto, evaluate } = run
await goto('http://localhost:5174/')
await sleep(1800)

process.stdout.write(`${JSON.stringify(await evaluate(`(() => {
  const cells = [...document.querySelectorAll('.el-table__body tr:first-child td')]
  return {
    tdClasses: cells.map(c => c.className),
    cellClasses: cells.map(c => c.querySelector('.cell')?.className),
    colAttrs: [...document.querySelectorAll('.el-table col')].map(c => c.className || c.getAttribute('class')),
    anyNumeric: document.querySelectorAll('.fbk-numeric').length,
  }
})()`), null, 2)}\n`)
run.close()
