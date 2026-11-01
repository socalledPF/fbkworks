import { resolve } from 'node:path'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import dts from 'vite-plugin-dts'
import { fixDtsImports } from './fix-dts-imports'

export interface VueLibOptions {
  root: string
  entries: Record<string, string>
  extraExternal?: Array<string | RegExp>
}

/**
 * vite-plugin-dts 写盘后修补说明符：把 `./x` 改成 `./x.js`，
 * 让 node16/nodenext 消费者也能解析（详见 fix-dts-imports.ts）。
 */
function dtsSpecifierPlugin(outDir: string): Plugin {
  return {
    name: 'fbk:fix-dts-specifiers',
    enforce: 'post',
    async closeBundle() {
      await fixDtsImports(outDir)
    },
  }
}

/**
 * 发布包的共享 Vite 配置。
 * 关键取舍：ESM-only + preserveModules + 样式独立文件（不做 SFC <style>）。
 */
export function defineVueLib(options: VueLibOptions): UserConfig {
  return defineConfig({
    root: options.root,
    plugins: [
      vue(),
      vueJsx(),
      dts({
        entryRoot: resolve(options.root, 'src'),
        tsconfigPath: resolve(options.root, 'tsconfig.json'),
        insertTypesEntry: true,
        cleanVueFileName: true,
        // 只声明 src，避免 tests/**/*.spec.d.ts 被当成额外产物写进 dist。
        include: [resolve(options.root, 'src')],
        // 默认会把 tsconfig paths 改写成指向源码的相对路径（../../../adapter-core/src/index.ts），
        // 这样发布出去的 d.ts 在消费者侧根本无法解析。必须保留包名说明符。
        pathsToAliases: false,
      }),
      dtsSpecifierPlugin(resolve(options.root, 'dist')),
    ],
    build: {
      target: 'es2022',
      sourcemap: true,
      minify: false,
      emptyOutDir: true,
      lib: {
        entry: options.entries,
        formats: ['es'],
      },
      rollupOptions: {
        external: [
          /^vue($|\/)/,
          /^@fbkworks\//,
          /^element-plus($|\/)/,
          /^vant($|\/)/,
          /^naive-ui($|\/)/,
          ...(options.extraExternal ?? []),
        ],
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  })
}

export {
  createWorkspaceAliases,
  describeWorkspaceAliases,
  findRepoRoot,
  type CreateWorkspaceAliasesOptions,
  type WorkspaceAlias,
} from './workspace-aliases'

