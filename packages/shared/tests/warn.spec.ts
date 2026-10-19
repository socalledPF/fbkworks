import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { resetWarnCache, warn, warnOnce } from '../src/warn'

describe('warn', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetWarnCache()
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('带 [fbk] 前缀', () => {
    warn('出错了')
    expect(spy).toHaveBeenCalledWith('[fbk] 出错了')
  })

  it('warnOnce 同一 key 只输出一次', () => {
    warnOnce('k', '第一次')
    warnOnce('k', '第二次')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('[fbk] 第一次')
  })

  it('不同 key 各输出一次', () => {
    warnOnce('a', 'A')
    warnOnce('b', 'B')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('resetWarnCache 后可以再次输出', () => {
    warnOnce('k', '一次')
    resetWarnCache()
    warnOnce('k', '两次')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
