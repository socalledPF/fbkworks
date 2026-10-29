import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

/**
 * 后台管理系统 demo 的构建配置。
 *
 * 与 playground 的区别：这里**只接 element-plus 一个适配器**，
 * 模拟真实项目的选择 —— 真实项目不会同时装三个 UI 库。
 */
const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: [
      { find: /^@fbkworks\/tokens\/css$/, replacement: r('../../packages/tokens/src/css/tokens.css') },
      { find: /^@fbkworks\/tokens\/dark\.css$/, replacement: r('../../packages/tokens/src/css/dark.css') },
      { find: /^@fbkworks\/tokens$/, replacement: r('../../packages/tokens/src/index.ts') },
      { find: /^@fbkworks\/shared$/, replacement: r('../../packages/shared/src/index.ts') },
      { find: /^@fbkworks\/adapter-core$/, replacement: r('../../packages/adapter-core/src/index.ts') },
      {
        find: /^@fbkworks\/adapter-element-plus$/,
        replacement: r('../../packages/adapters/element-plus/src/index.ts'),
      },
      { find: /^@fbkworks\/chart-core$/, replacement: r('../../packages/chart-core/src/index.ts') },
      { find: /^@fbkworks\/dashboard$/, replacement: r('../../packages/dashboard/src/index.ts') },
      // CSS 子路径必须排在通配规则前面，否则 style.css 会被拼成 style.css/index.ts
      {
        find: /^@fbkworks\/components\/(.*\.css)$/,
        replacement: r('../../packages/components/src/$1'),
      },
      { find: /^@fbkworks\/components$/, replacement: r('../../packages/components/src/index.ts') },
      {
        find: /^@fbkworks\/components\/(.*)$/,
        replacement: r('../../packages/components/src/$1/index.ts'),
      },
      {
        find: /^@fbkworks\/adapter-(element-plus|vant|naive-ui)\/(.*\.css)$/,
        replacement: r('../../packages/adapters/$1/src/$2'),
      },
    ],
  },
  server: { port: 5185 },
})
