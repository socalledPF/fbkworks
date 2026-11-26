import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 独立构建配置 —— 不 import 本仓库的任何内部包，复制出去就能用。
 *
 * 刻意**不写 @fbkworks/* 的 alias**：真实项目里这些包来自 node_modules
 * （先 pnpm install 再构建），模板保持同一条解析路径，才不会出现
 * 「仓库内靠 alias 能跑、复制出去解析失败」的假绿。
 */
export default defineConfig({
  plugins: [vue()],
  server: { port: 5288 },
})
