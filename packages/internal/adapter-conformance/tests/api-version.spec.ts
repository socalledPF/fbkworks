import { describe, expect, it } from 'vitest'
import { ADAPTER_API_VERSION, assertAdapterCompatible, type UiAdapter } from '@fbkworks/adapter-core'
import { createMockAdapter } from '@fbkworks/test-utils'

/**
 * 契约版本 3：Drawer 成为必填原语。
 *
 * 这里测的不是「版本号是多少」这个字面量，而是它的两个后果：
 * 旧适配器（缺 Drawer 或停留在版本 2）必须在装配时被拦下，
 * 而不是等到业务方点开详情抽屉时才发现屏上什么都没有。
 */

function withoutPrimitive(adapter: UiAdapter, key: keyof UiAdapter['primitives']): UiAdapter {
  const primitives = { ...adapter.primitives }
  delete primitives[key]
  return { ...adapter, primitives }
}

describe('适配器契约版本 3（Drawer 必填）', () => {
  it('版本号因新增必填原语而提升到 3', () => {
    expect(ADAPTER_API_VERSION).toBe(3)
  })

  it('缺少 Drawer 的适配器被 assertAdapterCompatible 拦下', () => {
    const broken = withoutPrimitive(createMockAdapter(), 'Drawer')
    expect(() => assertAdapterCompatible(broken)).toThrow(/Drawer/)
  })

  it('apiVersion 停在 2 的旧适配器被拦下', () => {
    const legacy = createMockAdapter()
    const stale: UiAdapter = { ...legacy, meta: { ...legacy.meta, apiVersion: 2 } }
    expect(() => assertAdapterCompatible(stale)).toThrow(/apiVersion/)
  })

  it('补齐 Drawer 后通过校验', () => {
    expect(() => assertAdapterCompatible(createMockAdapter())).not.toThrow()
  })
})
