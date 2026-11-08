import { describe, expect, it } from 'vitest'
import { assertAdapterCompatible, requirePrimitive } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'

/**
 * 可选原语层的**第二次**实操。
 *
 * `Drawer` 是这条路上唯一的成员，而「只有一个成员」意味着机制只被验证过一次 ——
 * 一次可能是巧合。这里用一个真实适配器**去掉** Drawer 来走一遍完整路径，
 * 确认三件事同时成立：
 *
 *   1. 缺可选原语仍然是一个合法适配器（否则「可选」只是文档措辞）
 *   2. 真去用它时立刻抛错，且错误里带适配器名字（不是 undefined 崩在深处）
 *   3. 缺**必填**原语仍然失败（可选层没有把门放宽）
 */
const withoutDrawer = {
  ...elementPlusAdapter,
  primitives: { ...elementPlusAdapter.primitives, Drawer: undefined },
}

const withoutButton = {
  ...elementPlusAdapter,
  primitives: { ...elementPlusAdapter.primitives, Button: undefined },
}

describe('可选原语层', () => {
  it('缺可选原语（Drawer）仍是合法适配器', () => {
    expect(() => assertAdapterCompatible(withoutDrawer as any)).not.toThrow()
  })

  it('真去用可选原语时抛错，且错误里带适配器名字', () => {
    expect(() => requirePrimitive(withoutDrawer as any, 'Drawer', '请改用整页。')).toThrow(
      /Drawer.*不可用|没有提供 Drawer/,
    )
    expect(() => requirePrimitive(withoutDrawer as any, 'Drawer', '请改用整页。')).toThrow(
      elementPlusAdapter.meta.name,
    )
  })

  it('缺必填原语（Button）仍然失败 —— 可选层没有放宽门禁', () => {
    expect(() => assertAdapterCompatible(withoutButton as any)).toThrow(/Button/)
  })
})
