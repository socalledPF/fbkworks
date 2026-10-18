/**
 * 依赖方向门禁（ESLint 之外的第二道闸）。
 *
 * ESLint 检查的是"文件里写了什么 import"，dependency-cruiser 检查的是
 * "解析后的真实依赖图"，能抓住路径别名、re-export 链、循环依赖等 ESLint 看不到的问题。
 *
 * 关键配置：doNotFollow 必须排除 @fbk，否则 depcruise 会顺着 pnpm 的 workspace
 * 符号链接钻进 node_modules 里的 dist，既慢又会误报。
 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: '循环依赖会让 tree-shaking 失效，并让构建顺序变得不可预测。',
      from: {},
      to: { circular: true },
    },
    {
      name: 'ui-libs-only-in-adapters',
      severity: 'error',
      comment:
        'UI 库只能出现在 packages/adapters/**。这是整套架构的命门——一旦业务组件 import type 了 element-plus，适配层就被击穿了。',
      from: {
        pathNot: '^packages/adapters/',
      },
      to: {
        // doNotFollow 关掉了 node_modules，未解析的依赖会以裸模块名出现，
        // 所以两种形态都要匹配。
        path: '^(node_modules/)?(element-plus|vant|naive-ui)(/|$)',
      },
    },
    {
      name: 'components-must-not-depend-on-adapters',
      severity: 'error',
      comment: '业务组件只依赖 adapter-core 契约，不依赖任何具体适配器。',
      from: { path: '^packages/components/' },
      to: { path: '^packages/adapters/' },
    },
    {
      name: 'adapters-must-not-depend-on-components',
      severity: 'error',
      comment: '适配器禁止反向依赖业务组件（会造成循环依赖与打包爆炸）。',
      from: { path: '^packages/adapters/' },
      to: { path: '^packages/components/' },
    },
    {
      name: 'core-must-not-depend-on-upstream',
      severity: 'error',
      comment: 'adapter-core 只能依赖 shared / tokens，不能依赖适配器或组件。',
      from: { path: '^packages/adapter-core/' },
      to: { path: '^packages/(adapters|components|resolver)/' },
    },
    {
      name: 'shared-must-stay-ui-agnostic',
      severity: 'error',
      comment: 'shared 是无 UI 语义的工具层，不能依赖 adapter-core 及以上。',
      from: { path: '^packages/shared/' },
      to: { path: '^packages/(adapter-core|adapters|components)/' },
    },
    {
      name: 'tokens-must-stay-leaf',
      severity: 'error',
      comment: 'tokens 是最底层，不能依赖任何其他 @fbk 包。',
      from: { path: '^packages/tokens/' },
      to: { path: '^packages/(shared|adapter-core|adapters|components)/' },
    },
    {
      name: 'no-business-runtime-deps',
      severity: 'error',
      comment: '组件库必须零业务运行时依赖：请求由调用方注入，日期格式化用 Intl。',
      from: { path: '^packages/(components|adapter-core|shared|tokens)/' },
      to: { path: '^node_modules/(axios|vue-router|dayjs|moment|lodash|@tanstack)/' },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: '孤儿模块通常是重构后忘记删除的文件。',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(package|turbo)\\.json$',
          '(^|/)(vite|vitest|eslint|dependency-cruiser|unbuild)\\.config\\.(ts|mjs|js)$',
          // 包的发布入口与构建配置不会被其他包 import，但它们不是孤儿
          '(^|/)build\\.config\\.ts$',
          '(^|/)src/index\\.ts$',
          '^apps/',
          '^scripts/',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: {
      // 不跟随 workspace 链接，避免解析进 node_modules 里的构建产物
      path: 'node_modules',
    },
    exclude: {
      path: ['node_modules', 'dist', '\\.turbo', 'coverage', 'apps/docs/\\.vitepress'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.json'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)' },
      archi: { collapsePattern: '^(packages|apps)/[^/]+' },
    },
  },
}
