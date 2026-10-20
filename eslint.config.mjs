import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

/**
 * 架构边界门禁。
 *
 * 最重要的规则只有一条：**只有 packages/adapters/** 可以 import UI 库，包括 import type**。
 * 很多"适配层"最终被 `import type { TableProps } from 'element-plus'` 悄悄击穿，
 * 所以这里显式写 allowTypeImports: false —— 这是整套架构的命门。
 */

const uiLibraryMessage =
  '业务代码不得直接依赖 UI 库（含 import type）。请通过 @fbk/adapter-core 的契约访问原语；' +
  '需要新增能力时先扩展 UiPrimitives 契约，再在 packages/adapters/* 中实现。'

const noUiImports = [
  {
    name: 'element-plus',
    message: uiLibraryMessage,
    allowTypeImports: false,
  },
  {
    name: 'vant',
    message: uiLibraryMessage,
    allowTypeImports: false,
  },
  {
    name: 'naive-ui',
    message: uiLibraryMessage,
    allowTypeImports: false,
  },
  {
    name: '@fbk/adapter-element-plus',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbk/adapter-core。',
    allowTypeImports: false,
  },
  {
    name: '@fbk/adapter-vant',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbk/adapter-core。',
    allowTypeImports: false,
  },
  {
    name: '@fbk/adapter-naive-ui',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbk/adapter-core。',
    allowTypeImports: false,
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      'apps/docs/.vitepress/cache/**',
      'apps/docs/.vitepress/dist/**',
      'apps/playground/dist/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        queueMicrotask: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 公开 API 的 props 解构需要保留响应性，允许 props 解构但禁止丢失响应性的写法由 review 把关
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      // 本项目的模板以紧凑写法为主；换行风格由 prettier 统一，不交给 ESLint 管
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      // 适配器与 mock adapter 用 defineComponent 在一个文件里导出多个原语，是有意为之
      'vue/one-component-per-file': 'off',
    },
  },

  // 边界 1：所有非适配器代码禁止触碰 UI 库
  {
    files: ['packages/**/*.{ts,tsx,vue}', 'apps/**/*.{ts,tsx,vue}', 'scripts/**/*.{ts,mts,mjs}'],
    ignores: ['packages/adapters/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: noUiImports }],
    },
  },

  // 边界 2：components 只能依赖 adapter-core / shared / tokens
  {
    files: ['packages/components/src/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: noUiImports,
          patterns: [
            {
              group: ['vue-router', 'axios', 'dayjs', 'moment', 'lodash'],
              message:
                '业务组件库必须零业务运行时依赖。日期格式化用 Intl，请求由调用方通过 request 注入。',
            },
            {
              group: ['@fbk/resolver', '@fbk/demos', '@fbk/test-utils'],
              message: '发布包不得依赖内部工具包。',
            },
          ],
        },
      ],
    },
  },

  // 边界 3：适配器禁止反向依赖业务组件
  {
    files: ['packages/adapters/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@fbk/components', '@fbk/components/*'],
              message: '适配器禁止反向依赖业务组件：依赖方向只能是 components → adapter-core ← adapters。',
            },
          ],
        },
      ],
    },
  },

  // 适配器内部：只允许导入自己对应的 UI 库，避免 element 适配器顺手用了 vant 的组件
  {
    files: ['packages/adapters/element-plus/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['vant', 'vant/*', 'naive-ui', 'naive-ui/*'], message: '适配器只能使用自己对应的 UI 库。' }] },
      ],
    },
  },
  {
    files: ['packages/adapters/vant/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['element-plus', 'element-plus/*', 'naive-ui', 'naive-ui/*'], message: '适配器只能使用自己对应的 UI 库。' }] },
      ],
    },
  },
  {
    files: ['packages/adapters/naive-ui/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['element-plus', 'element-plus/*', 'vant', 'vant/*'], message: '适配器只能使用自己对应的 UI 库。' }] },
      ],
    },
  },

  // 边界 4：Playground 与文档站是唯一允许同时依赖三个适配器的应用（都不发布）
  {
    files: ['apps/playground/**/*.{ts,tsx,vue}', 'apps/docs/**/*.{ts,tsx,vue,mts}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // 测试与内部工具可以放宽
  {
    files: [
      '**/tests/**/*.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'packages/internal/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 测试可以用 mock adapter 与内部工具包；仍禁止直接依赖 UI 库与具体适配器
      'no-restricted-imports': [
        'error',
        {
          paths: noUiImports,
          patterns: [
            {
              group: ['vue-router', 'axios', 'dayjs', 'moment', 'lodash'],
              message: '业务组件库必须零业务运行时依赖。',
            },
          ],
        },
      ],
    },
  },

  // 消费者烟雾测试故意同时 import 三个适配器，验证发布产物的 exports 映射
  {
    files: ['tests/consumer/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // 桌面端一致性对照测试：职责就是同时 import 两个桌面适配器做比对，
  // 这不是「业务组件依赖具体适配器」，而是测试本身的意义所在。
  {
    files: ['packages/internal/adapter-conformance/tests/desktop-parity.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // 配置文件与脚本
  // 脚本目录写成 **/scripts/**：包内也会有 scripts/（如 apps/docs/scripts/），
  // 只写 scripts/** 在 flat config 里只匹配仓库根目录那一层，包内的脚本会被漏掉。
  {
    files: ['**/*.config.{ts,mts,mjs,js}', '**/scripts/**/*.{mjs,mts,ts}'],
    rules: {
      'no-console': 'off',
      'no-restricted-imports': 'off',
    },
  },
)
