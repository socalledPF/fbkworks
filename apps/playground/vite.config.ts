import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: [
      { find: /^@fbk\/tokens\/css$/, replacement: r('../../packages/tokens/src/css/tokens.css') },
      { find: /^@fbk\/tokens\/dark\.css$/, replacement: r('../../packages/tokens/src/css/dark.css') },
      { find: /^@fbk\/tokens$/, replacement: r('../../packages/tokens/src/index.ts') },
      { find: /^@fbk\/shared$/, replacement: r('../../packages/shared/src/index.ts') },
      { find: /^@fbk\/adapter-core$/, replacement: r('../../packages/adapter-core/src/index.ts') },
      {
        find: /^@fbk\/adapter-element-plus$/,
        replacement: r('../../packages/adapters/element-plus/src/index.ts'),
      },
      { find: /^@fbk\/adapter-vant$/, replacement: r('../../packages/adapters/vant/src/index.ts') },
      {
        find: /^@fbk\/adapter-naive-ui$/,
        replacement: r('../../packages/adapters/naive-ui/src/index.ts'),
      },
      // CSS 子路径必须排在通配规则前面，否则 style.css 会被拼成 style.css/index.ts
      {
        find: /^@fbk\/components\/(.*\.css)$/,
        replacement: r('../../packages/components/src/$1'),
      },
      { find: /^@fbk\/components$/, replacement: r('../../packages/components/src/index.ts') },
      {
        find: /^@fbk\/components\/(.*)$/,
        replacement: r('../../packages/components/src/$1/index.ts'),
      },
      {
        find: /^@fbk\/adapter-(element-plus|vant|naive-ui)\/(.*\.css)$/,
        replacement: r('../../packages/adapters/$1/src/$2'),
      },
      { find: /^@fbk\/demos$/, replacement: r('../../packages/internal/demos/src/index.ts') },
    ],
  },
  server: {
    port: 5174,
  },
})
