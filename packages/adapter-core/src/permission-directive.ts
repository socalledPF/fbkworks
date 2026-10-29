import {
  effectScope,
  shallowRef,
  watchEffect,
  type Directive,
  type DirectiveBinding,
  type ShallowRef,
} from 'vue'
import { hasPermission, type PermissionResolver } from './permission'
import { warnOnce } from '@fbkworks/shared'

/**
 * `v-permission` 指令。
 *
 * ```vue
 * <button v-permission="'order:delete'">删除</button>
 * <button v-permission="['order:edit', 'order:delete' ]">编辑</button>
 * ```
 *
 * **关键设计 1：无权限时把元素从 DOM 里移除，而不是 display:none。**
 *
 * `display:none` 的按钮仍然存在于 DOM，自动化脚本、浏览器插件、
 * 甚至控制台一行 `el.click()` 都能触发它。移除才是「这个操作不存在」。
 *
 * 代价：移除后 Vue 的 patch 可能找不到它，所以用注释节点占位，
 * 权限恢复时能插回原位。
 *
 * **关键设计 2：用 effectScope + watchEffect 做响应式。**
 *
 * 指令的 `updated` 只在父组件重渲染时触发。用户切换、权限异步加载
 * 这类「数据变了但父组件没重渲染」的场景，`updated` 不会触发，
 * 元素就永远不会出现/消失。用 watchEffect 监听解析函数才能真正响应式。
 */

interface PermissionState {
  /** 必须是响应式来源：watchEffect 只追踪 ref/reactive，普通属性赋值不会让它重跑 */
  required: ShallowRef<string | string[]>
  placeholder: Comment
  scope: ReturnType<typeof effectScope>
  removed: boolean
}

interface PermissionEl extends HTMLElement {
  __fbkPermission?: PermissionState
}

function detach(el: PermissionEl, state: PermissionState) {
  if (state.removed) return
  const parent = el.parentNode
  if (!parent) return
  parent.replaceChild(state.placeholder, el)
  state.removed = true
}

function attach(el: PermissionEl, state: PermissionState) {
  if (!state.removed) return
  const parent = state.placeholder.parentNode
  if (!parent) return
  parent.replaceChild(el, state.placeholder)
  state.removed = false
}

export function createPermissionDirective(resolver: PermissionResolver): Directive<
  PermissionEl,
  string | string[]
> {
  return {
    mounted(el, binding: DirectiveBinding<string | string[]>) {
      const required = binding.value
      if (!required || (Array.isArray(required) && required.length === 0)) {
        warnOnce(
          'permission-empty-value',
          '[fbk] v-permission 的值为空，指令不生效。请传入权限点字符串或数组。',
        )
        return
      }

      const state: PermissionState = {
        required: shallowRef(required),
        placeholder: document.createComment(' v-permission '),
        scope: effectScope(),
        removed: false,
      }
      el.__fbkPermission = state

      // 放进独立 scope：指令卸载时一起停掉，避免泄漏
      state.scope.run(() => {
        watchEffect(() => {
          // resolver 内部读响应式数据，权限变化时这里会自动重跑
          const allowed = hasPermission(resolver(), state.required.value)
          if (allowed) attach(el, state)
          else detach(el, state)
        })
      })
    },

    updated(el, binding: DirectiveBinding<string | string[]>) {
      const state = el.__fbkPermission
      if (!state) return
      // 写回 ref 才会让上面的 watchEffect 重跑；同值赋值本身是空操作，不必比 oldValue
      state.required.value = binding.value
    },

    unmounted(el) {
      const state = el.__fbkPermission
      state?.scope.stop()
      if (state?.placeholder.parentNode) {
        state.placeholder.parentNode.removeChild(state.placeholder)
      }
      delete el.__fbkPermission
    },
  }
}
