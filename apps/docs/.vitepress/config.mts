import { defineConfig } from 'vitepress'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { createWorkspaceAliases } from '../../../packages/internal/build-config/src/index.ts'

export default withMermaid(
  defineConfig({
  title: 'FBK',
  description: 'Vue 3 企业级业务组件库：一套业务组件，三种 UI 适配器',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,

  // favicon 由 apps/docs/scripts/sync-brand.mjs 从 assets/brand/ 同步而来
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#2f6bff' }],
  ],

  themeConfig: {
    // 明暗两套标识：<img> 无法继承 currentColor，只能给两份文件
    logo: { light: '/fbk-mark.svg', dark: '/fbk-mark-dark.svg', alt: 'FBK' },

    nav: [
      { text: '指南', link: '/guide/introduction' },
      { text: '组件', link: '/components/pro-table' },
      { text: '适配器', link: '/adapters/overview' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '为什么需要适配层', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '架构总览（含设计图）', link: '/guide/architecture-diagrams' },
            { text: '架构与依赖规则', link: '/guide/architecture' },
            { text: '主题与暗色模式', link: '/guide/theming' },
            { text: '权限', link: '/guide/permission' },
            { text: '可观测性', link: '/guide/observability' },
          ],
        },
      ],
      '/components/': [
        {
          text: '业务组件',
          items: [
            { text: 'CrudPage CRUD 页面', link: '/components/crud-page' },
            { text: 'FormModal 弹窗表单', link: '/components/form-modal' },
            { text: 'Result 异常状态页', link: '/components/result' },
            { text: 'Dashboard 数据看板', link: '/components/dashboard' },
            { text: 'Screen 可视化大屏', link: '/components/screen' },
            { text: 'Data 数据层契约', link: '/components/data' },
            { text: 'DetailPage 详情页', link: '/components/detail-page' },
            { text: 'DetailDrawer 详情抽屉', link: '/components/detail-drawer' },
            { text: 'ProTable 高级表格', link: '/components/pro-table' },
            { text: 'QueryForm 查询表单', link: '/components/query-form' },
            { text: 'FormGenerator 表单生成器', link: '/components/form-generator' },
            { text: 'PageContainer 页面容器', link: '/components/page-container' },
            { text: 'Descriptions 描述列表', link: '/components/descriptions' },
          ],
        },
      ],
      '/adapters/': [
        {
          text: '适配器',
          items: [
            { text: '能力矩阵', link: '/adapters/overview' },
            { text: '编写自定义适配器', link: '/adapters/custom' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://example.com/fbk' }],

    outline: { level: [2, 3] },

    search: { provider: 'local' },
  },

  vite: {
    // 适配器是 TSX 写的，文档站直接编译源码时必须启用 JSX 转换，
    // 否则 h() 调用会被当成 React.createElement。
    plugins: [vueJsx()],

    // dev 模式下 Vite 只从 index.html 做依赖发现，element-plus / naive-ui 这些
    // 被间接 import 的 CJS 包（dayjs 等）不会被预打包，浏览器按 ESM 解析就会报
    // "does not provide an export named 'default'"。构建时 Rollup 会处理互操作，
    // 所以只有 dev 白屏。显式列出，保证 dev 与 build 行为一致。
    optimizeDeps: {
      include: [
        'dayjs',
        'dayjs/plugin/customParseFormat',
        'dayjs/plugin/advancedFormat',
        'dayjs/plugin/localeData',
        'dayjs/plugin/weekOfYear',
        'dayjs/plugin/weekYear',
        'dayjs/plugin/dayOfYear',
        'dayjs/plugin/isSameOrAfter',
        'dayjs/plugin/isSameOrBefore',
        'element-plus',
        'naive-ui',
        'vant',
        'mermaid',
      ],
    },

    resolve: {
      // 文档站直接编译源码，改组件无需先 build。
      // alias 由各包的 package.json → exports 推导，不在这里手写清单。
      alias: createWorkspaceAliases({ from: import.meta.dirname }),
    },
  },

  /* 架构图用 Mermaid 渲染。
     **必须写在 defineConfig 的配置对象里** —— vitepress-plugin-mermaid v2 的
     withMermaid 只接受一个参数，写成 withMermaid(config, {...}) 时第二个参数
     会被静默忽略（本文件原先就是这种写法，所以主题与下面的 useMaxWidth 都没生效）。

     这里**保留** mermaid 默认的 useMaxWidth（svg 挂 width="100%"），
     让整张图缩略后完整落在正文栏里 —— 一眼能看到整体结构。
     原始尺寸的细节交给点击放大（见 theme/mermaid-zoom.ts）。

     曾试过 useMaxWidth: false + 容器横向滚动，体验更差：
     图被正文栏截断、还要来回拖才能看全，反而看不出架构全貌。 */
  mermaid: {
    theme: 'base',
    themeVariables: {
      fontFamily: 'inherit',
      primaryColor: '#eef3ff',
      primaryBorderColor: '#2f6bff',
      lineColor: '#8a94a6',
    },
  },
  }),
)
