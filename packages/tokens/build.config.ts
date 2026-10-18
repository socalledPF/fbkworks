import { defineBuildConfig } from 'unbuild'

// 纯 TS 包：unbuild 产出 ESM + d.ts。
// 显式声明 entries，避免自动探测把 .css 当成入口。
// failOnWarn 关闭：exports 里的 dist/css/*.css 由 build 脚本在 unbuild 之后复制，
// unbuild 检查 exports 时文件尚未存在，属于预期的时序告警。
export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: false,
    inlineDependencies: false,
  },
})
