/**
 * unplugin-vue-components resolver。
 * 只解决“组件和样式从哪来”，不解决 adapter 注入 —— 文档需明确。
 */
export interface ComponentResolver {
  type: 'component'
  resolve: (name: string) => { name: string; from: string; sideEffects?: string } | undefined
}

interface ResolverOptions {
  /** 默认 true：自动导入组件对应样式 */
  importStyle?: boolean
}

const map: Record<string, { from: string; style: string }> = {
  FbkProTable: { from: '@fbk/components/pro-table', style: '@fbk/components/pro-table/style.css' },
  FbkQueryForm: { from: '@fbk/components/query-form', style: '@fbk/components/query-form/style.css' },
  FbkFormGenerator: {
    from: '@fbk/components/form-generator',
    style: '@fbk/components/form-generator/style.css',
  },
  FbkPageContainer: {
    from: '@fbk/components/page-container',
    style: '@fbk/components/page-container/style.css',
  },
  FbkDescriptions: {
    from: '@fbk/components/descriptions',
    style: '@fbk/components/descriptions/style.css',
  },
}

export function FbkResolver(options: ResolverOptions = {}): ComponentResolver {
  return {
    type: 'component',
    resolve(name) {
      const hit = map[name]
      if (!hit) return undefined
      return {
        name,
        from: hit.from,
        sideEffects: options.importStyle === false ? undefined : hit.style,
      }
    },
  }
}

export default FbkResolver
