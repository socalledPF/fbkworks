import { describe, expect, it, vi } from 'vitest'
import {
  NOOP_REPORTER,
  createReporter,
  safeContext,
  toErrorEvent,
} from '../src/observability'

/**
 * 可观测性。
 *
 * 核心约束：**默认零开销**。未传钩子时不能有任何采集行为，
 * 也不该因为上报器的存在而改变组件行为。
 */

describe('createReporter', () => {
  it('未传钩子时返回 noop 且 enabled 为 false', () => {
    const reporter = createReporter()
    expect(reporter.enabled).toBe(false)
    // 调用不抛错
    expect(() => reporter.error({ source: 'request', message: 'x' })).not.toThrow()
    expect(() => reporter.telemetry({ type: 'request', name: 'x' })).not.toThrow()
  })

  it('传了 onError 就 enabled', () => {
    const reporter = createReporter({ onError: () => {} })
    expect(reporter.enabled).toBe(true)
  })

  it('只传 onTelemetry 也 enabled', () => {
    const reporter = createReporter({ onTelemetry: () => {} })
    expect(reporter.enabled).toBe(true)
  })

  it('转发错误事件', () => {
    const onError = vi.fn()
    createReporter({ onError }).error({ source: 'request', message: 'boom' })
    expect(onError).toHaveBeenCalledWith({ source: 'request', message: 'boom' })
  })

  it('转发 telemetry 事件', () => {
    const onTelemetry = vi.fn()
    createReporter({ onTelemetry }).telemetry({ type: 'request', name: 'x', duration: 12 })
    expect(onTelemetry).toHaveBeenCalledWith({ type: 'request', name: 'x', duration: 12 })
  })

  it('上报器自身抛错时不影响业务', () => {
    // 这条很重要：监控代码不能把业务代码搞崩
    const reporter = createReporter({
      onError: () => {
        throw new Error('上报服务挂了')
      },
      onTelemetry: () => {
        throw new Error('上报服务挂了')
      },
    })
    expect(() => reporter.error({ source: 'request', message: 'x' })).not.toThrow()
    expect(() => reporter.telemetry({ type: 'request', name: 'x' })).not.toThrow()
  })

  it('暴露原始回调供嵌套 Provider 继承', () => {
    const onError = vi.fn()
    const reporter = createReporter({ onError })
    expect(reporter.handlers.onError).toBe(onError)
  })
})

describe('safeContext 截断', () => {
  it('保留原始值', () => {
    expect(safeContext({ a: 1, b: 'text', c: true, d: null })).toEqual({
      a: 1,
      b: 'text',
      c: true,
      d: null,
    })
  })

  it('长数组只保留前 5 项并标注总数', () => {
    const out = safeContext({ rows: [1, 2, 3, 4, 5, 6, 7, 8] })
    const rows = out!.rows as unknown[]
    expect(rows).toHaveLength(6) // 5 项 + 1 条摘要
    expect(String(rows[5])).toContain('共 8 项')
  })

  it('长字符串被截断并标注长度', () => {
    const long = 'x'.repeat(500)
    const out = safeContext({ text: long })
    expect(String(out!.text)).toContain('共 500 字符')
    expect(String(out!.text).length).toBeLessThan(long.length)
  })

  it('大对象只保留前 20 个 key', () => {
    const big = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    const out = safeContext(big)
    expect(Object.keys(out!)).toHaveLength(20)
  })

  it('Date 转 ISO 字符串', () => {
    const d = new Date('2026-10-25T00:00:00Z')
    expect(safeContext({ at: d })!.at).toBe('2026-10-25T00:00:00.000Z')
  })

  it('嵌套过深时省略', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } }
    const out = safeContext(deep)
    // 不抛错即可，具体截断位置不锁死
    expect(out).toBeTruthy()
  })

  it('非对象返回 undefined', () => {
    expect(safeContext('text')).toBeUndefined()
    expect(safeContext(null)).toBeUndefined()
    expect(safeContext(123)).toBeUndefined()
  })
})

describe('toErrorEvent', () => {
  it('从 Error 提取 message 与 stack', () => {
    const err = new Error('出错了')
    const event = toErrorEvent(err, 'request', 'FbkProTable')
    expect(event.message).toBe('出错了')
    expect(event.stack).toContain('Error')
    expect(event.source).toBe('request')
    expect(event.component).toBe('FbkProTable')
  })

  it('从非 Error 提取字符串', () => {
    const event = toErrorEvent('字符串错误', 'render')
    expect(event.message).toBe('字符串错误')
    expect(event.stack).toBeUndefined()
  })

  it('上下文被截断', () => {
    const event = toErrorEvent(new Error('x'), 'request', 'C', {
      rows: Array.from({ length: 100 }, (_, i) => i),
    })
    expect((event.context!.rows as unknown[]).length).toBeLessThan(100)
  })
})

describe('NOOP_REPORTER', () => {
  it('enabled 为 false 且调用安全', () => {
    expect(NOOP_REPORTER.enabled).toBe(false)
    expect(() => NOOP_REPORTER.error({ source: 'render', message: 'x' })).not.toThrow()
  })

  it('handlers 为空对象', () => {
    expect(NOOP_REPORTER.handlers).toEqual({})
  })
})
