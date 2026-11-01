import { describe, expect, it } from 'vitest'
import {
  ADAPTER_API_VERSION,
  assertAdapterCompatible,
  requirePrimitive,
  type UiAdapter,
} from '@fbkworks/adapter-core'
import { createMockAdapter } from '@fbkworks/test-utils'

/**
 * 适配器契约的兼容性边界。
 *
 * 现行规则：
 *   · 版本号停在旧值的适配器 —— 装配时拦下（它可能缺必填原语或契约形状不同）
 *   · 缺**必填**原语（DataGrid 等）—— 装配时拦下
 *   · 缺**可选**原语（Drawer）—— 放行；只在真正渲染 FbkDetailDrawer 时由
 *     requirePrimitive 抛出带替代方案的错误
 *
 * 三条合起来说明版本号只管「改坏已有」：把必填改成可选是更宽松的约束，
 * 不升版本号（见 docs/design/2026-10-28-optional-primitive-layer.md）。
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

  /* Drawer 已改为**可选**原语：缺了它不再被启动校验拦下，
     只在真正渲染 FbkDetailDrawer 时才报错（见 requirePrimitive）。
     版本号因此没有提升 —— 把必填改成可选是更宽松的约束。 */
  it('缺少 Drawer 的适配器不再被启动校验拦下', () => {
    const noDrawer = withoutPrimitive(createMockAdapter(), 'Drawer')
    expect(() => assertAdapterCompatible(noDrawer)).not.toThrow()
  })

  it('缺少必填原语（DataGrid）仍然被拦下', () => {
    const broken = withoutPrimitive(createMockAdapter(), 'DataGrid')
    expect(() => assertAdapterCompatible(broken)).toThrow(/DataGrid/)
  })

  it('缺少 Drawer 时 requirePrimitive 抛出带替代方案的错误', () => {
    const noDrawer = withoutPrimitive(createMockAdapter(), 'Drawer')
    expect(() => requirePrimitive(noDrawer, 'Drawer', '可改用 FbkDetailPage。')).toThrow(
      /Drawer.*FbkDetailPage/s,
    )
  })

  it('apiVersion 停在 2 的旧适配器被拦下', () => {
    const legacy = createMockAdapter()
    const stale: UiAdapter = { ...legacy, meta: { ...legacy.meta, apiVersion: 2 } }
    expect(() => assertAdapterCompatible(stale)).toThrow(/apiVersion/)
  })

  it('完整适配器通过校验', () => {
    expect(() => assertAdapterCompatible(createMockAdapter())).not.toThrow()
  })
})
