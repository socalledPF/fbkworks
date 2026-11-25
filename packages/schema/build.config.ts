import { defineBuildConfig } from 'unbuild'

// 纯 TS 包：unbuild 产出 ESM + d.ts。
// 显式声明 entries，避免自动探测把 .css 当成入口。
export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: false,
  },
})
