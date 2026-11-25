import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  '业务代码不得直接依赖 UI 库（含 import type）。请通过 @fbkworks/adapter-core 的契约访问原语；' +
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
    name: '@fbkworks/adapter-element-plus',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbkworks/adapter-core。',
    allowTypeImports: false,
  },
  {
    name: '@fbkworks/adapter-vant',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbkworks/adapter-core。',
    allowTypeImports: false,
  },
  {
    name: '@fbkworks/adapter-naive-ui',
    message: '业务组件不得依赖具体适配器，只能依赖 @fbkworks/adapter-core。',
    allowTypeImports: false,
  },
]

/**
 * 第一类：禁止的运行时依赖（必须由调用方注入）。
 *
 * 判定标准：换一个后端 / 框架 / UI 库，这段代码就不成立了。
 * 详见 docs/style-guide.md 的「运行时依赖三类划分」。
 *
 * 注意这里**只是第一类**。第二类（日期/工具库，需评审）不在这里拦，
 * 因为它需要看具体场景 —— 用硬规则拦住会逼着大家写更差的替代实现
 * （shared/format.ts 里那 132 行手工日期拼接就是前车之鉴）。
 */
const FORBIDDEN_RUNTIME_DEPS = [
  // 传输层：库无权锁定调用方用什么 HTTP 客户端
  'axios',
  'ky',
  'ofetch',
  'superagent',
  // 路由与状态：库不该假设 SPA 结构
  'vue-router',
  'pinia',
  'vuex',
  // 全局 i18n：库应接受 locale 参数而不是读全局实例
  'vue-i18n',
  // 工具库：平台有等价能力
  'dayjs',
  'moment',
  'lodash',
  'ramda',
  'date-fns',
]

/**
 * 所有发布包（不含内部工具包与适配器）——**从磁盘派生，不手写**。
 *
 * 手写清单是记录，事实一变它就变成谎。这条清单已经漏过两次：先漏 chart-core /
 * dashboard / screen，后漏 resolver —— 后者是真实发布包（0.3.0、没写 private），
 * 却因此不受下面两条发布包规则约束，等于可以悄悄 import dayjs / axios 而 lint 全绿，
 * 而且没有任何门禁看得出来（lint 只跑「已经进了清单的包」，看不见自己漏了谁）。
 *
 * 判据交给文件系统：`packages/*` 下有 package.json 且 `private !== true`。
 *
 * 谓词为什么是 `private !== true` 而不是 `private === false`：本仓库的发布包**省略**
 * 这个字段，只有不发布的包才显式写 `private: true`。check-runtime-deps /
 * gen-api-snapshot / gen-size-baseline / publish-all 四道门用的全是这同一个谓词 ——
 * 这里必须与它们一致，否则又多出一份「发布包清单」各说各话。
 *
 * `packages/adapters/*` 与 `packages/internal/*` 不是 `packages/*` 的直接子目录，
 * 天然排除，正合「不含内部工具包与适配器」的口径。
 *
 * 成本：ESLint 配置每个进程执行一次，1 次 readdirSync + 10 次 readFileSync，可忽略。
 * （本文件没有别的缓存机制，也不需要：守住的是「清单等于事实」，不是启动耗时。）
 */
const PACKAGES_DIR = fileURLToPath(new URL('./packages/', import.meta.url))
const PUBLISHED_PACKAGES = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(PACKAGES_DIR, entry.name, 'package.json')))
  .filter(
    (entry) => JSON.parse(readFileSync(join(PACKAGES_DIR, entry.name, 'package.json'), 'utf8')).private !== true,
  )
  .map((entry) => `packages/${entry.name}`)
  .sort()

/** 生成 `packages/x/src/**` 形式的 glob */
const publishedSrcGlobs = PUBLISHED_PACKAGES.map((p) => `${p}/src/**/*.{ts,tsx,vue}`)

const runtimeDepMessage =
  '这是第一类禁止依赖（传输/路由/状态/i18n/工具库），必须由调用方注入。' +
  '请求通过 request prop 注入，日期用 Intl，详见 docs/style-guide.md。' +
  '如果确实无法替代，请走第二类评审流程而不是绕过这条规则。'


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
      /* patterns 必须有：paths 按**精确模块名**匹配，`element-plus/dist/index.css`
         这类子路径一条都不命中 —— 而那正是「缺样式就补一行 import」的写法。 */
      'no-restricted-imports': [
        'error',
        {
          paths: noUiImports,
          patterns: [
            {
              group: ['element-plus/*', 'vant/*', 'naive-ui/*'],
              message: uiLibraryMessage,
              allowTypeImports: false,
            },
          ],
        },
      ],
    },
  },

  // 边界 2：所有发布包禁止第一类运行时依赖 + 内部工具包
  {
    files: publishedSrcGlobs,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: noUiImports,
          patterns: [
            {
              group: FORBIDDEN_RUNTIME_DEPS,
              message: runtimeDepMessage,
            },
            {
              group: ['@fbkworks/resolver', '@fbkworks/demos', '@fbkworks/test-utils'],
              message: '发布包不得依赖内部工具包。',
            },
            {
              /* 必须写在这个规则对象里：flat config 中**后写的同名规则会整条替换前面的**，
                 所以边界 1（files 含 packages/**）里的那组 UI 子路径 patterns 在发布包里
                 从来没生效过 —— 实测在 packages/components 写
                 import 'element-plus/dist/index.css' 时 eslint 0 报错。
                 paths 按精确模块名匹配，子路径一条都不命中，因此这里必须用 patterns。 */
              group: ['element-plus/*', 'vant/*', 'naive-ui/*'],
              message: uiLibraryMessage,
              allowTypeImports: false,
            },
          ],
        },
      ],

      /*
       * 动态 import 与 require 绕过检查。
       *
       * 实测过：`import('dayjs')` 不会被 no-restricted-imports 拦住
       * （那条规则只看静态 import 声明），dependency-cruiser 也漏掉了它。
       * 而按需加载恰恰是最容易写成动态 import 的地方。
       *
       * 同时拦截模板字符串拼接包名（`da${'yjs'}`），
       * 那种写法是刻意规避检查的信号。
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportExpression > Literal[value=/^(axios|ky|ofetch|superagent|vue-router|pinia|vuex|vue-i18n|dayjs|moment|lodash|ramda|date-fns)(\\/.*)?$/]',
          message: `${runtimeDepMessage}（检测到动态 import）`,
        },
        {
          selector: 'ImportExpression > TemplateLiteral',
          message:
            '禁止用模板字符串拼接模块名做动态 import —— 这会绕过依赖检查。' +
            '请用静态字符串字面量，让构建期能静态分析。',
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: '禁止 require：本项目是 ESM-only。',
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
              group: ['@fbkworks/components', '@fbkworks/components/*'],
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

  // 边界 4：应用层（不发布）允许依赖适配器
  {
    files: ['apps/playground/**/*.{ts,tsx,vue}', 'apps/docs/**/*.{ts,tsx,vue,mts}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  /*
   * admin 是「只接一个适配器」的应用 demo。
   *
   * 与 playground 的区别值得保留在规则里：playground 是组件评审台，
   * 需要同时接三个适配器对比；admin 模拟真实项目，只该接一个。
   * 所以这里**只放行 element-plus**，同时接其他适配器仍会报错 ——
   * 防止 demo 慢慢退化成第二个 playground。
   */
  {
    files: ['apps/admin/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@fbkworks/adapter-vant',
              message: 'admin demo 只接 element-plus 一个适配器（模拟真实项目）。',
            },
            {
              name: '@fbkworks/adapter-naive-ui',
              message: 'admin demo 只接 element-plus 一个适配器（模拟真实项目）。',
            },
          ],
        },
      ],
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
    /* 一致性测试的**全部职责**就是对比具体适配器：桌面端 parity 要比 element-plus 与
       naive-ui，sort 语义对照要比这两家的 update:sort 载荷。src/ 仍受约束——
       它必须是泛型的，不能绑死某一家。原先是单文件豁免，新增第二个对照用例时
       就得再补一条，索性按目录给。 */
    files: ['packages/internal/adapter-conformance/tests/*.spec.ts'],
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
