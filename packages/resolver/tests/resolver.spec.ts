import { describe, expect, it } from 'vitest'
import { FbkResolver } from '../src'

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
    const noStyle = FbkResolver({ importStyle: false })
    expect(noStyle.resolve('FbkQueryForm')).toEqual({
      name: 'FbkQueryForm',
      from: '@fbkworks/components/query-form',
      sideEffects: undefined,
    })
  })

  it('每个业务组件都有对应的子路径与样式入口', () => {
    const names = [
      'FbkProTable',
      'FbkQueryForm',
      'FbkFormGenerator',
      'FbkPageContainer',
      'FbkDescriptions',
      'FbkCrudPage',
      'FbkFormModal',
      'FbkResult',
      'FbkDetailPage',
    ]

    for (const name of names) {
      const hit = resolver.resolve(name)
      expect(hit, name).toBeDefined()
      expect(hit!.from).toMatch(/^@fbkworks\/components\/[a-z-]+$/)
      expect(hit!.sideEffects).toBe(`${hit!.from}/style.css`)
    }
  })
})
