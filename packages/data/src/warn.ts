/**
 * 本地的一份 warnOnce。
 *
 * 为什么不从 @fbkworks/shared 引：shared 的入口会 re-export useControllableState，
 * 于是它的产物顶层就是 `import { ref, computed } from "vue"` ——
 * 任何 import @fbkworks/data 的场景（Node 侧脚本、单测、非 Vue 宿主）都要能解析到 vue，
 * 而这个包对外宣称自己是「与 UI 库无关的纯逻辑」。
 * 代价是 14 行重复代码，换来 data 的运行时依赖清零。
 */
const warned = new Set<string>()

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  if (typeof console !== "undefined") console.warn(`[fbk/data] ${message}`)
}
