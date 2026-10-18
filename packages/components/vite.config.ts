// 相对路径直接引用源码：workspace 包被 pnpm 链接进 node_modules 后会被 Vite
// 当作外部依赖交给 Node 加载，而 Node 不认识 .ts 扩展名。相对导入由 esbuild 内联。
import { defineVueLib } from '../internal/build-config/src/index.ts'

export default defineVueLib({
  root: import.meta.dirname,
  entries: {
    index: 'src/index.ts',
    'pro-table/index': 'src/pro-table/index.ts',
    'query-form/index': 'src/query-form/index.ts',
    'form-generator/index': 'src/form-generator/index.ts',
    'page-container/index': 'src/page-container/index.ts',
    'descriptions/index': 'src/descriptions/index.ts',
  },
})
