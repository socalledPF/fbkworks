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
      /* 图表三兄弟原本没有 alias，走 package.json 的 exports 即加载 dist ——
         改这三个包的 src/style.css 在 playground 里看不到任何变化，必须先 build。
         而 style-guide 说 playground 是唯一的可视化验证环境，
         「改了看不到」会让「测试全绿、肉眼全坏」再发生一次。
         同样：CSS 子路径规则必须排在裸包名之前。 */
      { find: /^@fbk\/chart-core\/(.*\.css)$/, replacement: r('../../packages/chart-core/src/$1') },
      { find: /^@fbk\/chart-core$/, replacement: r('../../packages/chart-core/src/index.ts') },
      { find: /^@fbk\/dashboard\/(.*\.css)$/, replacement: r('../../packages/dashboard/src/$1') },
      { find: /^@fbk\/dashboard$/, replacement: r('../../packages/dashboard/src/index.ts') },
      { find: /^@fbk\/screen\/(.*\.css)$/, replacement: r('../../packages/screen/src/$1') },
      { find: /^@fbk\/screen$/, replacement: r('../../packages/screen/src/index.ts') },
    ],
  },
  server: {
    port: 5174,
  },
})
