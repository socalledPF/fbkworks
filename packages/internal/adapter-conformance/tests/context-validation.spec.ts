import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { ADAPTER_CONTEXT, createAdapterContext, useAdapter } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'

/**
 * 三条入口（assertAdapterCompatible / useAdapter / requirePrimitive）对**同一个**适配器
 * 必须给出同一个结论。以前 useAdapter 只查 apiVersion，于是一个版本号正确、
 * 但缺 DataGrid 的适配器：assertAdapterCompatible 拒绝、useAdapter 放行。
 */
const Probe = defineComponent({
  setup() {
    useAdapter()
    return () => h('div')
  },
})

const mountWith = (adapter: any) => {
  const ctx = createAdapterContext({ adapter })
  return mount(Probe, { global: { provide: { [ADAPTER_CONTEXT as symbol]: ctx } } })
}

describe('useAdapter 的校验强度', () => {
  it('合法适配器照常通过', () => {
    expect(() => mountWith(elementPlusAdapter)).not.toThrow()
  })

  it('apiVersion 正确但缺必填原语 —— 也必须拒绝', () => {
    const broken = {
      ...elementPlusAdapter,
      primitives: { ...elementPlusAdapter.primitives } as Record<string, unknown>,
    }
    delete broken.primitives.DataGrid
    expect(() => mountWith(broken)).toThrow(/DataGrid/)
  })
})
