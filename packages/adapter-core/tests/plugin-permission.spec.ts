import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  resolveDirective,
  withDirectives,
} from 'vue'
import { resetWarnCache } from '@fbk/shared'
import { createMockAdapter } from '@fbk/test-utils'
import { createBusinessKit, FbkProvider } from '../src/plugin'
import { usePermission } from '../src/permission'
import { createPermissionDirective } from '../src/permission-directive'

/**
 * v-permission 与 <FbkProvider> / 插件的装配关系。
 *
 * 要害：指令注册在 **app 级**指令表上，Vue 是「后注册顶掉先注册」且只 dev warn。
 * 所以 Provider 每次挂载都重注册一次时，插件配置的解析器会被后挂载的
 * (() => []) 顶掉 —— 按钮全部消失，但控制台没有错误。
 */

/** 走 Vue 真实的指令解析：没注册时会 warn "Failed to resolve directive" 且静默不生效 */
function guarded(id: string, required: string | string[]) {
  return withDirectives(h('button', { id }, '删除'), [[resolveDirective('permission')!, required]])
}

const containers: HTMLElement[] = []

function createContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  containers.push(el)
  return el
}

beforeEach(() => {
  resetWarnCache()
})

afterEach(() => {
  for (const el of containers.splice(0)) el.remove()
  vi.restoreAllMocks()
})

describe('v-permission 注册：插件与 Provider 共存', () => {
  it('Vue 语义实测：同一 app 内后注册的指令顶掉先注册的，只 warn 不报错', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = createApp({ render: () => null })
    const first = createPermissionDirective(() => ['order:delete'])
    const second = createPermissionDirective(() => [])

    app.directive('permission', first)
    expect(app.directive('permission')).toBe(first)

    app.directive('permission', second)
    // 后注册的那份生效 —— 这正是「先注册的解析器被悄悄接管」
    expect(app.directive('permission')).toBe(second)
    expect(warn.mock.calls.flat().join(' ')).toContain(
      'Directive "permission" has already been registered',
    )
  })

  it('两个解析器同时存在时：真正执行的是后注册的那份（实测调用次数）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const firstCalls: string[] = []
    const secondCalls: string[] = []
    const app = createApp({
      render: () =>
        h('div', [
          withDirectives(h('button', { id: 'btn' }, '删除'), [
            [resolveDirective('permission')!, 'order:delete'],
          ]),
        ]),
    })
    app.directive(
      'permission',
      createPermissionDirective(() => {
        firstCalls.push('x')
        return ['order:delete']
      }),
    )
    app.directive(
      'permission',
      createPermissionDirective(() => {
        secondCalls.push('x')
        return []
      }),
    )

    const container = createContainer()
    app.mount(container)
    await nextTick()

    // 后注册的解析器接管 → 元素消失；先注册的那份一次都没跑
    expect(secondCalls.length).toBeGreaterThan(0)
    expect(firstCalls.length).toBe(0)
    expect(container.querySelector('#btn')).toBeNull()
    // 而 Vue 只给了一句 dev warn，没有抛错
    expect(warn.mock.calls.flat().join(' ')).toContain('has already been registered')

    app.unmount()
  })

  it('插件传了 permissions、Provider 没传：指令不被顶掉，权限仍按插件判定', async () => {
    const app = createApp({
      render: () =>
        h(FbkProvider, null, {
          default: () => h('div', [guarded('ok', 'order:delete'), guarded('no', 'user:delete')]),
        }),
    })
    app.use(createBusinessKit({ adapter: createMockAdapter(), permissions: () => ['order:delete'] }))
    const installed = app.directive('permission')
    expect(installed).toBeTruthy()

    const container = createContainer()
    app.mount(container)
    await nextTick()

    // 有权限的留下，无权限的移除 —— 证明解析器仍是被插件配置的那份
    expect(container.querySelector('#ok')).not.toBeNull()
    expect(container.querySelector('#no')).toBeNull()
    // 指令实例没被 Provider 换掉
    expect(app.directive('permission')).toBe(installed)

    app.unmount()
  })

  it('同一 app 内第二个 Provider 挂载时不覆盖已注册的指令', async () => {
    const extra = ref(false)
    const app = createApp({
      render: () =>
        h('div', [
          h(
            FbkProvider,
            { adapter: createMockAdapter(), permissions: () => ['order:delete'] },
            { default: () => guarded('ok', 'order:delete') },
          ),
          extra.value
            ? h(FbkProvider, { adapter: createMockAdapter(), permissions: () => [] }, { default: () => h('i', { id: 'second' }) })
            : null,
        ]),
    })
    const container = createContainer()
    app.mount(container)
    await nextTick()

    const first = app.directive('permission')
    expect(first).toBeTruthy()
    expect(container.querySelector('#ok')).not.toBeNull()

    // 再挂一个权限为空、且没传 adapter（继承上层）的 Provider
    extra.value = true
    await nextTick()

    expect(app.directive('permission')).toBe(first)
    expect(container.querySelector('#second')).not.toBeNull()
    expect(container.querySelector('#ok')).not.toBeNull()

    app.unmount()
  })

  it('Provider 未传 permissions 时继承上层权限点（usePermission 不被清空）', async () => {
    let canDelete: boolean | undefined
    const Child = defineComponent({
      setup() {
        const { can } = usePermission()
        return () => {
          canDelete = can('order:delete')
          return h('span')
        }
      },
    })
    const app = createApp({
      render: () => h(FbkProvider, null, { default: () => h(Child) }),
    })
    app.use(createBusinessKit({ adapter: createMockAdapter(), permissions: () => ['order:delete'] }))

    const container = createContainer()
    app.mount(container)
    await nextTick()

    expect(canDelete).toBe(true)
    app.unmount()
  })
})

describe('v-permission 注册：只用 Provider 不装插件', () => {
  it('指令仍可解析并生效（不回归 "Failed to resolve directive"）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = createApp({
      render: () =>
        h(
          FbkProvider,
          { adapter: createMockAdapter(), permissions: () => ['order:delete'] },
          { default: () => h('div', [guarded('ok', 'order:delete'), guarded('no', 'user:delete')]) },
        ),
    })

    const container = createContainer()
    app.mount(container)
    await nextTick()

    expect(app.directive('permission')).toBeTruthy()
    expect(container.querySelector('#ok')).not.toBeNull()
    expect(container.querySelector('#no')).toBeNull()
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Failed to resolve directive')

    app.unmount()
  })

  it('多 app 各自注册，互不干扰（判重不能做成模块级标记）', async () => {
    const appA = createApp({
      render: () =>
        h(
          FbkProvider,
          { adapter: createMockAdapter(), permissions: () => ['order:delete'] },
          { default: () => guarded('ok', 'order:delete') },
        ),
    })
    const appB = createApp({
      render: () =>
        h(
          FbkProvider,
          { adapter: createMockAdapter(), permissions: () => ['order:read'] },
          { default: () => guarded('ok', 'order:delete') },
        ),
    })

    const containerA = createContainer()
    const containerB = createContainer()
    appA.mount(containerA)
    appB.mount(containerB)
    await nextTick()

    expect(containerA.querySelector('#ok')).not.toBeNull()
    expect(containerB.querySelector('#ok')).toBeNull()
    expect(appA.directive('permission')).not.toBe(appB.directive('permission'))

    appA.unmount()
    appB.unmount()
  })
})
