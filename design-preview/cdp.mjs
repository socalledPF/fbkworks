// Minimal CDP driver for visual verification of design-preview CSS.
import { Buffer } from 'node:buffer'
import fs from 'node:fs'

const PORT = 9222
const BASE = `http://127.0.0.1:${PORT}`

async function newTab(url) {
  const r = await fetch(`${BASE}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  return r.json()
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const listeners = []
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rej(new Error(JSON.stringify(msg.error)))
        else res(msg.result)
      } else if (msg.method) {
        for (const l of listeners) l(msg)
      }
    }
    ws.onerror = reject
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const n = ++id
            pending.set(n, { resolve: res, reject: rej })
            ws.send(JSON.stringify({ id: n, method, params }))
          }),
        on: (fn) => listeners.push(fn),
        close: () => ws.close(),
      })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const target = await newTab('about:blank')
  const cdp = await connect(target.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  })

  const goto = async (url) => {
    const loaded = new Promise((res) => {
      const off = (m) => { if (m.method === 'Page.loadEventFired') res() }
      cdp.on(off)
    })
    await cdp.send('Page.navigate', { url })
    await loaded
    await sleep(2500)
  }

  const evaluate = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', {
      expression: expr, awaitPromise: true, returnByValue: true,
    })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description ?? ''))
    return r.result.value
  }

  const inject = async (files) => {
    const css = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
    await evaluate(`(() => {
      document.getElementById('fbk-preview')?.remove()
      const s = document.createElement('style')
      s.id = 'fbk-preview'
      s.textContent = ${JSON.stringify(css)}
      document.head.appendChild(s)
      return true
    })()`)
  }

  const shot = async (path, opts = {}) => {
    const r = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: opts.full ?? false,
      ...(opts.clip ? { clip: { ...opts.clip, scale: 1 } } : {}),
    })
    fs.writeFileSync(path, new Uint8Array(Buffer.from(r.data, 'base64')))
    return path
  }

  return { cdp, goto, evaluate, inject, shot, sleep, close: () => cdp.close() }
}

export { main, sleep }
