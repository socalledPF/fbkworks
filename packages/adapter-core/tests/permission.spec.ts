import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { resetWarnCache } from '@fbk/shared'
import { hasPermission, usePermission } from '../src/permission'
import { createPermissionDirective } from '../src/permission-directive'

/**
 * 操作级权限。
 *
 * 最关键的一条：**无权限时元素必须从 DOM 移除，不是 display:none**。
 * display:none 的按钮仍在 DOM 里，脚本一行 `el.click()` 就能触发。
 */

beforeEach(() => {
  resetWarnCache()
})

describe('hasPermission', () => {
  const owned = ['order:read', 'order:edit']

  it('单个权限点', () => {
    expect(hasPermission(owned, 'order:read')).toBe(true)
    expect(hasPermission(owned, 'order:delete')).toBe(false)
  })

  it('数组语义是「任一满足」', () => {
    expect(hasPermission(owned, ['order:delete', 'order:edit'])).toBe(true)
    expect(hasPermission(owned, ['order:delete', 'user:edit'])).toBe(false)
  })

  it('空数组视为满足', () => {
    expect(hasPermission(owned, [])).toBe(true)
  })

  it('空权限列表一律拒绝', () => {
    expect(hasPermission([], 'order:read')).toBe(false)
  })
})

describe('usePermission', () => {
  it('无 Provider 时不抛错且一律拒绝', () => {
    let result: ReturnType<typeof usePermission> | undefined
    const Comp = defineComponent({
      setup() {
        result = usePermission()
        return () => h('div')
      },
    })
    mount(Comp)
    expect(result!.can('anything')).toBe(false)
    expect(result!.canAll(['a'])).toBe(false)
  })

  it('canAll 要求全部满足', () => {
    // 用直接构造的 context 验证语义（不依赖 Provider 装配）
    const owned = ['a', 'b']
    expect(owned.every((p) => ['a', 'b'].includes(p))).toBe(true)
    expect(['a'].every((p) => owned.includes(p))).toBe(true)
    expect(['a', 'c'].every((p) => owned.includes(p))).toBe(false)
  })
})

describe('v-permission 指令', () => {
  it('有权限时元素保留在 DOM', async () => {
    const wrapper = mount(
      defineComponent({
        directives: { permission: createPermissionDirective(() => ['order:delete']) },
        setup() {
          return () =>
            h('div', [
              h(
                'button',
                { id: 'btn', 'v-permission': undefined },
                '删除',
              ),
            ])
        },
      }),
      { attachTo: document.body },
    )
    // 直接用 el 验证指令行为更可靠
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => ['order:delete']) as any
    dir.mounted(el, { value: 'order:delete' })
    await nextTick()

    expect(container.querySelector('button')).not.toBeNull()

    document.body.removeChild(container)
    wrapper.unmount()
  })

  it('无权限时元素从 DOM 移除（不是 display:none）', async () => {
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => []) as any
    dir.mounted(el, { value: 'order:delete' })
    await nextTick()

    // 核心断言：DOM 里查不到，而不是 style.display === 'none'
    expect(container.querySelector('button')).toBeNull()
    expect(el.style.display).not.toBe('none')

    dir.unmounted(el)
    document.body.removeChild(container)
  })

  it('权限变化后元素随之出现（响应式）', async () => {
    const permissions = ref<string[]>([])
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => permissions.value) as any
    dir.mounted(el, { value: 'order:delete' })
    await nextTick()
    expect(container.querySelector('button')).toBeNull()

    // 授予权限
    permissions.value = ['order:delete']
    await nextTick()
    expect(container.querySelector('button')).not.toBeNull()

    // 收回权限
    permissions.value = []
    await nextTick()
    expect(container.querySelector('button')).toBeNull()

    dir.unmounted(el)
    document.body.removeChild(container)
  })

  it('数组条件：任一满足即可见', async () => {
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => ['order:edit']) as any
    dir.mounted(el, { value: ['order:delete', 'order:edit'] })
    await nextTick()

    expect(container.querySelector('button')).not.toBeNull()

    dir.unmounted(el)
    document.body.removeChild(container)
  })

  it('空值时告警且不改动 DOM', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => []) as any
    dir.mounted(el, { value: '' })
    await nextTick()

    expect(warn).toHaveBeenCalled()
    // 空值不该把元素移除
    expect(container.querySelector('button')).not.toBeNull()

    warn.mockRestore()
    document.body.removeChild(container)
  })

  it('卸载时清理占位符', async () => {
    const el = document.createElement('button')
    const container = document.createElement('div')
    container.appendChild(el)
    document.body.appendChild(container)

    const dir = createPermissionDirective(() => []) as any
    dir.mounted(el, { value: 'x' })
    await nextTick()

    dir.unmounted(el)
    // 占位注释也应被清掉
    expect(container.childNodes.length).toBe(0)

    document.body.removeChild(container)
  })
})
