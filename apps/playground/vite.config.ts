import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
// 相对路径而不是包名：vite 加载配置文件时会把 node_modules 依赖外部化，
// 包名入口指向 .ts 会让 Node 直接加载而报 ERR_UNKNOWN_FILE_EXTENSION。
// 各包的 vite.config.ts 也是这么引的，保持一致。
import { createWorkspaceAliases } from '../../packages/internal/build-config/src/index.ts'

/**
 * Playground 的构建配置。
 *
 * alias 由 `@fbkworks/build-config` 按各包的 `package.json` → `exports` 推导，
 * 不在这里手写清单 —— 手写的清单会漂移，而这个仓库已经在同一件事上
 * 漂移过三次（playground 缺图表三包、docs 缺四包、admin 缺 data）。
 *
 * 需要应用特有的别名时：`[...createWorkspaceAliases(...), ...自己的]`。
 * Vite 的 alias 是顺序匹配、先命中生效，所以要覆盖某条就放在展开之前。
 */
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: createWorkspaceAliases({ from: import.meta.dirname }),
  },
  server: {
    port: 5174,
  },
})
