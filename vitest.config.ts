import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@fbkworks/tokens': r('./packages/tokens/src/index.ts'),
      '@fbkworks/shared': r('./packages/shared/src/index.ts'),
      '@fbkworks/adapter-core': r('./packages/adapter-core/src/index.ts'),
      '@fbkworks/adapter-element-plus': r('./packages/adapters/element-plus/src/index.ts'),
      '@fbkworks/adapter-vant': r('./packages/adapters/vant/src/index.ts'),
      '@fbkworks/adapter-naive-ui': r('./packages/adapters/naive-ui/src/index.ts'),
      '@fbkworks/components': r('./packages/components/src/index.ts'),
      /* 下面这几个原先把入口留给 package.json 的 exports —— 也就是 dist。
         本地能过是因为 dist 已经构建过；CI 全新检出没有 dist，Vite 会直接报
         "Failed to resolve entry for package"。测试应该测源码，不是测产物。 */
      '@fbkworks/data': r('./packages/data/src/index.ts'),
      '@fbkworks/chart-core': r('./packages/chart-core/src/index.ts'),
      '@fbkworks/dashboard': r('./packages/dashboard/src/index.ts'),
      '@fbkworks/screen': r('./packages/screen/src/index.ts'),
      '@fbkworks/resolver': r('./packages/resolver/src/index.ts'),
      '@fbkworks/test-utils': r('./packages/internal/test-utils/src/index.ts'),
      '@fbkworks/adapter-conformance': r('./packages/internal/adapter-conformance/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    /* jsdom 默认**不提供 requestAnimationFrame**，除非打开 pretendToBeVisual。
       真实后果（compat job 实测，element-plus 2.8.0）：
         ReferenceError: requestAnimationFrame is not defined
           at ElTable doLayout（debounce 排的那一帧，在测试环境拆除后触发）
       用例全过、但 vitest 把它记成 unhandled error → pnpm test 退出 1。
       这不是某一个用例的问题，而是「组件库会在动画帧里排活」这一类问题 ——
       在环境里补上 rAF，比在每个用例里等一拍更可靠。 */
    environmentOptions: { jsdom: { pretendToBeVisual: true } },
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['packages/**/tests/**/*.spec.ts', 'packages/**/tests/**/*.spec.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
