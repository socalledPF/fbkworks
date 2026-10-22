// 相对路径直接引用源码：workspace 包被 pnpm 链接进 node_modules 后会被 Vite
// 当作外部依赖交给 Node 加载，而 Node 不认识 .ts 扩展名。相对导入由 esbuild 内联。
import { defineVueLib } from '../internal/build-config/src/index.ts'

export default defineVueLib({
  root: import.meta.dirname,
  entries: {
    index: 'src/index.ts',
  },
  /* echarts 必须是 external：
     它是 peerDependency（由业务方安装），打进产物会让包从 ~30KB 膨胀到 1MB+，
     而且会导致同一个 echarts 被打包两份（业务方自己 import 的那份 + 我们的），
     实例注册表分裂，图表根本渲染不出来。 */
  extraExternal: [/^echarts($|\/)/, /^zrender($|\/)/],
})
