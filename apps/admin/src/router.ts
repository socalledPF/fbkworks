/**
 * 极简路由。
 *
 * 为什么不用 vue-router：
 *   demo 需要模拟真实后台的导航，但引入 vue-router 会让 demo 依赖一个
 *   组件库明确禁止的库（第一类禁止依赖）。这里用 40 行实现
 *   「hash 路由 + 参数解析」够用的部分 —— 这本身也是对约束的一次验证：
 *   去掉 vue-router 到底会损失多少？
 *
 * 结论：对这种规模的 demo，损失几乎为零。
 * 真实项目该用 vue-router，但那是**应用层**的选择，不是组件库的选择。
 */

import { computed, ref } from 'vue'

const currentHash = ref(typeof location !== 'undefined' ? location.hash.slice(1) || '/' : '/')

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    currentHash.value = location.hash.slice(1) || '/'
  })
}

export const route = computed(() => currentHash.value)

/** 解析 /orders/12 → { path: '/orders/12', segments: ['orders', '12'] } */
export const segments = computed(() =>
  currentHash.value.split('/').filter(Boolean),
)

/** 路由参数（第二段起） */
export const params = computed(() => segments.value.slice(1))

export function navigate(path: string): void {
  location.hash = path
}

/** 判断某个菜单项是否激活（前缀匹配，/orders 在 /orders/12 时也算激活） */
export function isActive(prefix: string): boolean {
  const p = currentHash.value
  if (prefix === '/') return p === '/' || p === ''
  return p === prefix || p.startsWith(`${prefix}/`)
}
