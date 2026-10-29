import { inject, type InjectionKey } from 'vue'
import { warnOnce } from '@fbkworks/shared'

/**
 * 操作级权限。
 *
 * 设计见 docs/design/2026-10-25-permission.md。
 *
 * 边界：
 *   · **不做路由级** —— 库不该知道路由结构
 *   · **不做角色映射** —— 那是应用的用户体系
 *   · 只做「权限点 → 元素是否存在」这一件原子能力
 */

/** 权限点解析函数。返回当前用户拥有的权限点列表 */
export type PermissionResolver = () => string[]

export interface PermissionContext {
  /** 取当前权限点。每次调用都重新取，天然响应式 */
  getPermissions: PermissionResolver
}

/**
 * 用 Symbol.for 保持与其他 context 一致的跨副本行为。
 */
export const PERMISSION_CONTEXT = Symbol.for('fbk.permission.context') as unknown as InjectionKey<
  PermissionContext
>

/** 判断是否拥有某个权限点 */
export function hasPermission(permissions: readonly string[], required: string | string[]): boolean {
  if (Array.isArray(required)) {
    // 数组语义：**任一满足**即可。全部满足用 canAll
    if (required.length === 0) return true
    return required.some((p) => permissions.includes(p))
  }
  return permissions.includes(required)
}

/**
 * 权限判断 hook。
 *
 * 没有 Provider 时返回「全部拒绝」而不是抛错 ——
 * 组件在独立使用（如 Playground 单组件演示）时不该崩。
 */
export function usePermission() {
  const ctx = inject(PERMISSION_CONTEXT, null)

  if (!ctx) {
    warnOnce(
      'permission-no-provider',
      '[fbk] 未提供权限上下文，v-permission 与 usePermission() 将一律判定为无权限。\n' +
        '  在 createBusinessKit({ permissions: () => user.permissions }) 或 ' +
        '<FbkProvider :permissions="..."> 中提供。',
    )
  }

  const current = () => ctx?.getPermissions() ?? []

  return {
    /** 是否拥有某个权限点（数组语义为「任一」） */
    can: (required: string | string[]) => hasPermission(current(), required),
    /** 任一满足 */
    canAny: (required: string[]) => hasPermission(current(), required),
    /** 全部满足 */
    canAll: (required: string[]) => {
      const owned = current()
      return required.every((p) => owned.includes(p))
    },
    /** 取当前权限点快照（调试用） */
    list: () => [...current()],
  }
}
