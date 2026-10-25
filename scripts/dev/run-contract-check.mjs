#!/usr/bin/env node
/**
 * 自动起后端 → 跑契约验证 → 关后端。
 *
 * 为什么要包一层：手动「先起服务、再跑脚本、再关服务」太容易忘，
 * 忘了就会卡在端口占用上。
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// 默认用 0 = 让系统分配空闲端口，避免与已运行的服务冲突
const REQUESTED_PORT = Number(process.argv[2] ?? 0)

const server = spawn(process.execPath, [resolve(root, 'scripts/dev/mock-backend.mjs'), String(REQUESTED_PORT)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverReady = false
let actualPort = null
server.stdout.on('data', (d) => {
  const text = String(d)
  process.stdout.write(text)
  const m = /listening on http:\/\/localhost:(\d+)/.exec(text)
  if (m) {
    actualPort = Number(m[1])
    serverReady = true
  }
})
server.stderr.on('data', (d) => process.stderr.write(d))

/** 等后端就绪（最多 5 秒） */
async function waitReady() {
  for (let i = 0; i < 50; i++) {
    if (serverReady) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

function cleanup() {
  if (!server.killed) server.kill()
}

process.on('exit', cleanup)
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

const ready = await waitReady()
if (!ready) {
  console.error('[verify:data-contract] mock 后端启动超时')
  cleanup()
  process.exit(1)
}

const check = spawn(
  process.execPath,
  [resolve(root, 'scripts/dev/verify-data-contract.mjs'), String(actualPort)],
  { cwd: root, stdio: 'inherit' },
)

check.on('exit', (code) => {
  cleanup()
  process.exit(code ?? 1)
})
