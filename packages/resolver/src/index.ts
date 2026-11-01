/**
 * unplugin-vue-components resolver。
 * 只解决「组件和样式从哪来」，不解决 adapter 注入 —— 文档需明确。
 *
 * 映射表由 `scripts/gen-resolver-map.mjs` 从 components 的导出与目录结构生成
 * （见 ./generated-map.ts），不在这里手写。手写清单会与 components 漂移，
 * 而漂移的后果是自动导入静默失效：`.vue` 里写 <FbkXxx> 不报错，只是不生效。
 */
import { componentMap } from './generated-map'

export interface ComponentResolver {
  type: 'component'
  resolve: (name: string) => { name: string; from: string; sideEffects?: string } | undefined
}

export interface ResolverOptions {
  /** 默认 true：自动导入组件对应样式 */
  importStyle?: boolean
}

export function FbkResolver(options: ResolverOptions = {}): ComponentResolver {
  return {
    type: 'component',
    resolve(name) {
      const hit = componentMap[name]
      if (!hit) return undefined
      return {
        name,
        from: `@fbkworks/components/${hit.subpath}`,
        sideEffects: options.importStyle === false ? undefined : hit.style,
      }
    },
  }
}

export default FbkResolver
export { componentMap } from './generated-map'
export type { ResolverEntry } from './generated-map'
