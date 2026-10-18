import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@fbk/tokens': r('./packages/tokens/src/index.ts'),
      '@fbk/shared': r('./packages/shared/src/index.ts'),
      '@fbk/adapter-core': r('./packages/adapter-core/src/index.ts'),
      '@fbk/adapter-element-plus': r('./packages/adapters/element-plus/src/index.ts'),
      '@fbk/adapter-vant': r('./packages/adapters/vant/src/index.ts'),
      '@fbk/adapter-naive-ui': r('./packages/adapters/naive-ui/src/index.ts'),
      '@fbk/components': r('./packages/components/src/index.ts'),
      '@fbk/test-utils': r('./packages/internal/test-utils/src/index.ts'),
      '@fbk/adapter-conformance': r('./packages/internal/adapter-conformance/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['packages/**/tests/**/*.spec.ts', 'packages/**/tests/**/*.spec.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
