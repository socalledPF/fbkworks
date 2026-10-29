import { warnOnce } from '@fbkworks/shared'

/**
 * 数据级权限提醒。
 *
 * **这不是校验 —— 前端无法真正校验权限。**
 * 若接口返回了 1000 条，前端隐藏 900 条，那 1000 条依然在
 * 浏览器 Network 面板里。任何有浏览器的人都能看到。
 *
 * 它的价值在于：把「前端隐藏不构成权限」这件事，
 * 出现在写代码的那一刻，而不是等安全审计时被指出来。
 *
 * 仅开发环境提醒。用 NODE_ENV 而不是 import.meta.env：
 * 后者依赖 vite 类型，会让这个纯逻辑包绑定构建工具。
 */
export function assertServerScope(feature: string): void {
  // 生产环境直接返回，零开销
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return

  warnOnce(
    `data-scope-${feature}`,
    `[fbk/data] "${feature}" 的数据级权限必须由服务端过滤。\n` +
      '  前端隐藏不构成权限 —— 列表接口已返回全部数据，\n' +
      '  任何用户都能在浏览器 Network 面板看到完整内容。\n' +
      '  如果你确认服务端已按权限过滤，可以忽略这条提醒，\n' +
      '  或改用 createPageRequest({ scope: "server-filtered" }) 显式声明。',
  )
}
