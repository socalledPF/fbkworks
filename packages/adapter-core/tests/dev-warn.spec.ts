import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWarnCache } from '@fbkworks/shared'
import {
  REMOVED_PROPS,
  UNIMPLEMENTED_PROPS,
  devWarnRemovedProps,
  devWarnUnimplemented,
  devWarnUnknownProps,
} from '../src/dev-warn'

/**
 * 开发期 prop 校验。
 *
 * 三条必须被钉住的契约：
 *   1. 文案**可执行**：不能只说「这个字段无效」，要给出现在该写什么；
 *   2. 只走 warnOnce：渲染循环里同一个键会被调用几百次，刷屏的提示等于没有提示；
 *   3. **DEV 守卫不能被人顺手删掉** —— 删了之后生产包里会开始打日志。
 *      最后那条用例就是为此存在的（stubEnv 把 DEV 关掉，三个入口都必须闭嘴）。
 */

const ALLOWED = ['columns', 'emptyText'] as const

describe('devWarnUnknownProps', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetWarnCache()
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('未声明的 prop 报警，并列出可用字段（可执行）', () => {
    devWarnUnknownProps('ProTable', { toolbar: false }, ALLOWED)

    expect(spy).toHaveBeenCalledTimes(1)
    const message = spy.mock.calls[0][0] as string
    expect(message).toContain('ProTable 收到未声明的 prop「toolbar」')
    expect(message).toContain('可用字段：columns、emptyText')
  })

  it('已声明的 prop 与 Vue 自有属性都不报警', () => {
    devWarnUnknownProps(
      'ProTable',
      {
        emptyText: '空',
        class: 'x',
        style: 'color:red',
        id: 't',
        onClick: () => {},
        'data-test': '1',
        'aria-label': '表格',
      },
      ALLOWED,
    )

    expect(spy).not.toHaveBeenCalled()
  })

  it('登记表里的已移除字段给出替代写法', () => {
    devWarnUnknownProps('ProTableColumn', { hideInCard: true }, ALLOWED)

    const message = spy.mock.calls[0][0] as string
    expect(message).toContain('ProTableColumn 不再接受「hideInCard」')
    expect(message).toContain('mobile.hidden')
  })

  it('同一字段只提示一次（warnOnce，不刷屏）', () => {
    devWarnUnknownProps('ProTable', { toolbar: false }, ALLOWED)
    devWarnUnknownProps('ProTable', { toolbar: false }, ALLOWED)
    devWarnUnknownProps('ProTable', { toolbar: false, actions: {} }, ALLOWED)

    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('devWarnRemovedProps', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetWarnCache()
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('只对登记表命中的字段说话（继承来的合法字段不误报）', () => {
    devWarnRemovedProps('ProTableColumn', {
      key: 'name',
      title: '名称',
      mobile: { hidden: true },
      tooltip: '说明',
    })
    expect(spy).not.toHaveBeenCalled()

    devWarnRemovedProps('ProTableColumn', { key: 'name', hideInCard: true })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0] as string).toContain('mobile.hidden')
  })

  it('FormField.dependencies 指向「本来就会重算」', () => {
    devWarnRemovedProps('FormField', { name: 'city', dependencies: ['province'] })

    const message = spy.mock.calls[0][0] as string
    expect(message).toContain('FormField 不再接受「dependencies」')
    expect(message).toContain('每次值变化时重算')
  })
})

describe('devWarnUnimplemented', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetWarnCache()
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('文案 = 字段 + 当前无效 + 登记表里的替代写法', () => {
    devWarnUnimplemented('ProTableColumn', 'search', UNIMPLEMENTED_PROPS['ProTableColumn.search'])

    const message = spy.mock.calls[0][0] as string
    expect(message).toContain('ProTableColumn.search 当前无效：')
    expect(message).toContain('QueryForm')
  })

  it('同一字段只说明一次', () => {
    devWarnUnimplemented('ProTableColumn', 'search', '改用 QueryForm')
    devWarnUnimplemented('ProTableColumn', 'search', '改用 QueryForm')

    expect(spy).toHaveBeenCalledTimes(1)
  })
})

/**
 * 关于 DEV 守卫，为什么这里**没有**「DEV=false 时不输出」的用例：
 *
 * 实测（vitest 3 / vite 6）：被 import 的源码模块里 `import.meta.env` 在 transform 阶段
 * 就被替换成字面量，`vi.stubEnv('DEV', false)` 改的是测试文件自己那份 env 对象，
 * 对模块内的守卫无效 —— 写出来的用例会是「恒真」的假绿，比没有更糟。
 *
 * 守卫本身由静态门禁守：`pnpm check:dev-warn` 要求每个 devWarn* 调用点所在文件里
 * `import.meta.env` 出现在调用**之前**。删掉守卫或把调用挪出守卫块，门禁立刻变红
 * （实测过：删掉 ProTable.vue 的那两行 → [dev-warn] 发现 1 处问题）。
 */
describe('登记表', () => {
  it('两张表都有内容（否则「什么都不报」会伪装成通过）', () => {
    expect(Object.keys(REMOVED_PROPS).length).toBeGreaterThan(0)
    expect(Object.keys(UNIMPLEMENTED_PROPS).length).toBeGreaterThan(0)
  })

  it('已移除字段的文案指向具体替代写法，而不是「已废弃」', () => {
    expect(REMOVED_PROPS['ProTableColumn.hideInCard']).toContain('mobile.hidden')
    expect(REMOVED_PROPS['FormField.dependencies']).toContain('重算')
    expect(UNIMPLEMENTED_PROPS['ProTableColumn.search']).toContain('QueryForm')
  })
})
