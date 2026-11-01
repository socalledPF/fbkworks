import { describe, expect, it } from 'vitest'
import * as components from '@fbkworks/components'
import { FbkResolver, componentMap } from '../src'

/**
 * 判据全部来自 components 的实际导出，**没有任何硬编码名单**。
 *
 * 这是关键：原先的用例里写死了 9 个组件名，而那份名单与映射同源 ——
 * 新增组件时两处一起漏，测试照样全绿。P4-2 的 FbkDetailDrawer 就是这么漏的。
 */
const exportedComponents = Object.keys(components)
  .filter((name) => name.startsWith('Fbk'))
  .sort()

describe('FbkResolver', () => {
  const resolver = FbkResolver()

  it('解析已注册的组件并带上样式副作用', () => {
    expect(resolver.resolve('FbkProTable')).toEqual({
      name: 'FbkProTable',
      from: '@fbkworks/components/pro-table',
      sideEffects: '@fbkworks/components/pro-table/style.css',
    })
  })

  it('未注册的组件返回 undefined，不误伤其他库', () => {
    expect(resolver.resolve('ElButton')).toBeUndefined()
    expect(resolver.resolve('VanButton')).toBeUndefined()
  })

  it('importStyle: false 时不注入样式', () => {
    expect(FbkResolver({ importStyle: false }).resolve('FbkQueryForm')).toEqual({
      name: 'FbkQueryForm',
      from: '@fbkworks/components/query-form',
      sideEffects: undefined,
    })
  })

  it('映射覆盖 components 导出的全部 Fbk* 组件（判据来自导出，不是名单）', () => {
    expect(Object.keys(componentMap).sort()).toEqual(exportedComponents)
  })

  it('每个导出的组件都能解析出合法子路径', () => {
    for (const name of exportedComponents) {
      const hit = resolver.resolve(name)
      expect(hit, name).toBeDefined()
      expect(hit!.from, name).toMatch(/^@fbkworks\/components\/[a-z-]+$/)
      // 有自己 style.css 的组件必须带样式副作用；没有的（如 DetailDrawer）为 undefined
      if (hit!.sideEffects !== undefined) {
        expect(hit!.sideEffects, name).toBe(`${hit!.from}/style.css`)
      }
    }
  })
})
