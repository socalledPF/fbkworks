import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWarnCache } from '@fbkworks/shared'
import { __resetChartRegistration, isFbkChartsRegistered, registerFbkCharts } from '../src/register'

/**
 * 按需注册。
 *
 * 两个联合类型的现状不一样：
 *   · `FbkChartType` 与 CHART_MAP 一一对应（'map' 已删除，见 types.ts），
 *     这条一致性由 register.ts 的 satisfies 在编译期强制；
 *   · `FbkChartComponent` 仍比 COMPONENT_MAP 宽（'geo' / 'toolbox' 还没实现）。
 * 对「绕过类型传进来的未登记项」必须当作「没注册上」处理 —— 标记成已注册会让它永不重试，
 * 表现是图表静默空白，且没有任何线索指向原因。
 */
const warned = (): string[] => (console.warn as any).mock.calls.map((c: any[]) => String(c[0]))

describe('registerFbkCharts', () => {
  beforeEach(() => {
    __resetChartRegistration()
    resetWarnCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    __resetChartRegistration()
    resetWarnCache()
  })

  /* map 已从 FbkChartType 删除（本库不支持地图）。这些用例要表达的是
     「调用方绕过类型传了未登记的类型」——用 as any 显式越界，而不是让联合类型留一个假成员。 */
  it('未登记的类型给出告警，且同样请求只提示一次', () => {
    registerFbkCharts({ charts: ['map' as any], components: [] })
    registerFbkCharts({ charts: ['map' as any], components: [] })

    const mapWarns = warned().filter((m) => m.includes('map'))
    expect(mapWarns, JSON.stringify(warned())).toHaveLength(1)
  })

  it('未登记的组件同样给出告警', () => {
    registerFbkCharts({ charts: [], components: ['geo', 'toolbox'] })

    const messages = warned().join('\n')
    expect(messages).toContain('geo')
    expect(messages).toContain('toolbox')
  })

  it('请求的项一个都没实现时不算注册成功', () => {
    registerFbkCharts({ charts: ['map' as any], components: ['geo', 'toolbox'] })
    expect(isFbkChartsRegistered()).toBe(false)
  })

  it('未登记的项不会被标记为已注册，下次调用仍会重试', () => {
    const mapWarns = () => warned().filter((m) => m.includes('"map"')).length

    registerFbkCharts({ charts: ['map' as any], components: [] })
    const first = mapWarns()

    // 清掉去重缓存后再调一次：若被误标为已注册，这里会走早退分支、不再告警
    resetWarnCache()
    registerFbkCharts({ charts: ['map' as any], components: [] })

    expect(first).toBe(1)
    expect(mapWarns()).toBe(2)
  })

  it('合法类型照常注册，缺失项不影响其它项', () => {
    registerFbkCharts({ charts: ['line', 'map' as any], components: ['grid'] })
    expect(isFbkChartsRegistered()).toBe(true)
    expect(warned().join('\n')).toContain('map')
  })
})
