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
  FbkProTable: { from: '@fbkworks/components/pro-table', style: '@fbkworks/components/pro-table/style.css' },
  FbkQueryForm: { from: '@fbkworks/components/query-form', style: '@fbkworks/components/query-form/style.css' },
  FbkFormGenerator: {
    from: '@fbkworks/components/form-generator',
    style: '@fbkworks/components/form-generator/style.css',
  },
  FbkPageContainer: {
    from: '@fbkworks/components/page-container',
    style: '@fbkworks/components/page-container/style.css',
  },
  FbkDescriptions: {
    from: '@fbkworks/components/descriptions',
    style: '@fbkworks/components/descriptions/style.css',
  },
  FbkCrudPage: { from: '@fbkworks/components/crud-page', style: '@fbkworks/components/crud-page/style.css' },
  FbkFormModal: { from: '@fbkworks/components/form-modal', style: '@fbkworks/components/form-modal/style.css' },
  FbkResult: { from: '@fbkworks/components/result', style: '@fbkworks/components/result/style.css' },
  FbkDetailPage: {
    from: '@fbkworks/components/detail-page',
    style: '@fbkworks/components/detail-page/style.css',
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
