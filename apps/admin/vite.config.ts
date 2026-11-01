import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { createWorkspaceAliases } from '../../packages/internal/build-config/src/index.ts'

/**
 * 后台管理系统 demo 的构建配置。
 *
 * 与 playground 的区别在**接入了哪个适配器**（见 src/adapters.ts），
 * 不在 alias —— 「真实项目不会同时装三个 UI 库」是关于使用方式的选择，
 * 不是关于包怎么解析的选择。alias 一律由 build-config 推导。
 */
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: createWorkspaceAliases({ from: import.meta.dirname }),
  },
  server: { port: 5185 },
})
