import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatterCacheSize as __formatterCacheSize,
  resetFormatterCache as __resetFormatterCache,
} from '../src/format'

describe('formatNumber', () => {
  it('千分位分组', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('空值输出占位符', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber(undefined)).toBe('-')
    expect(formatNumber('')).toBe('-')
  })

  it('非数字原样返回，不抛错', () => {
    expect(formatNumber('abc')).toBe('abc')
    expect(formatNumber(NaN)).toBe('NaN')
  })

  it('数字字符串按数值格式化', () => {
    expect(formatNumber('1234.5')).toBe('1,234.5')
  })

  it('locale 参数生效', () => {
    // 德语用点做千分位、逗号做小数点，是最容易看出 locale 是否真的被用上的语言
    expect(formatNumber(1234.5, undefined, 'de-DE')).toBe('1.234,5')
    expect(formatNumber(1234.5, undefined, 'en-US')).toBe('1,234.5')
  })

  it('默认 locale 保持 zh-CN 行为', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5')
  })
})

describe('formatMoney', () => {
  it('固定两位小数', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
    expect(formatMoney(20)).toBe('20.00')
  })

  it('空值输出占位符', () => {
    expect(formatMoney(null)).toBe('-')
  })

  it('精度可调', () => {
    expect(formatMoney(1234.567, 3)).toBe('1,234.567')
    expect(formatMoney(1234.5, 0)).toBe('1,235')
  })

  it('locale 参数生效', () => {
    expect(formatMoney(1234.5, 2, 'de-DE')).toBe('1.234,50')
  })

  it('不输出货币符号（文档承诺的格式）', () => {
    // shared/README 曾写成 `¥1,234.50`，实际没有符号。锁定真实行为。
    expect(formatMoney(1234.5)).not.toContain('¥')
  })
})

describe('formatDate', () => {
  it('date 只到日', () => {
    expect(formatDate(new Date(2026, 8, 1, 10, 30))).toBe('2026-09-01')
  })

  it('datetime 到分钟', () => {
    expect(formatDate(new Date(2026, 8, 1, 10, 30), 'datetime')).toBe('2026-09-01 10:30')
  })

  it('time 只有时分', () => {
    expect(formatDate(new Date(2026, 8, 1, 10, 30), 'time')).toBe('10:30')
  })

  it('空值输出占位符', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
    expect(formatDate('')).toBe('-')
  })

  it('非法日期原样返回', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('布尔值不应被当成时间戳（1970-01-01）', () => {
    // new Date(true) 会得到 1970-01-01，这在表格里显示成"有效日期"比报错更危险
    expect(formatDate(true)).toBe('true')
    expect(formatDate(false)).toBe('false')
  })

  it('Date 与 ISO 字符串往返一致', () => {
    const date = new Date(2026, 8, 1, 10, 30)
    expect(formatDate(date.toISOString(), 'datetime')).toBe(formatDate(date, 'datetime'))
  })

  it('毫秒数按本地时区渲染', () => {
    expect(formatDate(new Date(2026, 8, 1, 10, 30).getTime(), 'datetime')).toBe('2026-09-01 10:30')
  })
})

/**
 * 缓存键必须对语义相同的 options 稳定命中。
 * 旧实现用 JSON.stringify，键序不同会重复建表，SSR 下模块级 Map 还会无限增长。
 */
describe('格式化缓存', () => {
  it('options 键序不同，语义相同的调用复用同一个 formatter', () => {
    __resetFormatterCache()
    formatNumber(1.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    formatNumber(1.5, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    expect(__formatterCacheSize()).toBe(1)
  })

  it('缓存有条数上限，SSR 长跑不会无限增长', () => {
    __resetFormatterCache()
    for (let i = 0; i < 300; i += 1) {
      formatNumber(1, { maximumFractionDigits: (i % 60) + 1 })
    }
    expect(__formatterCacheSize()).toBeLessThanOrEqual(50)
  })
})
