import type { AdapterName } from './adapters'
import { adapters } from './adapters'
import './styles'
import { createApp, h, reactive } from 'vue'

/**
 * 能力探针页（`/probe.html?adapter=element-plus`）。
 *
 * 存在的理由：有三条能力位**在 jsdom 里根本测不出来**，只能靠真实浏览器：
 *   · form.labelWidth      —— 需要测量标签实际宽度
 *   · form.validateOn      —— element-plus 在 jsdom 下 validate() 直接返回 true
 *                             （已实测：绕开适配器、直接用原生 ElForm 也一样）
 *   · form.asyncValidator  —— 依赖异步校验器真正结算
 *
 * 它们由 scripts/visual/verify-form-capabilities.py 驱动，
 * 覆盖状态在 capability-coverage.ts 里记为 browserOnly。
 *
 * 独立的 HTML 入口而不是加到 SPA 里：不进 demo 注册表、不影响用户看到的示例。
 */
const params = new URLSearchParams(location.search)
const name = (params.get('adapter') ?? 'element-plus') as AdapterName
const adapter = adapters[name] ?? adapters['element-plus']
const p = adapter.primitives

const model = reactive({ short: '', long: '', async: '' })

const rules = {
  short: [{ required: true, message: 'PROBE_REQUIRED_SHORT', trigger: 'blur' }],
  async: [
    {
      validator: async (value: unknown) => {
        await new Promise((resolve) => setTimeout(resolve, 40))
        return value === 'ok' ? true : 'PROBE_ASYNC_ASYNC'
      },
      trigger: 'blur',
    },
  ],
}

/** 每个字段包一层带 data 属性的 div：不同 UI 库的 DOM 结构互不相同，只用这层定位 */
const field = (key: string, label: string) =>
  h('div', { 'data-probe-field': key }, [
    h(p.FormItem, { prop: key, label }, () =>
      h(p.Input, {
        modelValue: model[key as keyof typeof model],
        'onUpdate:modelValue': (value: string) => {
          model[key as keyof typeof model] = value
        },
      }),
    ),
  ])

const Probe = {
  name: 'FbkFormProbe',
  setup() {
    return () =>
      h('div', {
        'data-fbk-probe': 'forms',
        'data-adapter': adapter.meta.name,
        /* 把能力声明暴露给验证脚本：能力为 false 的项不该被断言，
           否则会把「本就不承诺」误判成缺陷。 */
        'data-capabilities': JSON.stringify(adapter.capabilities),
      }, [
        h(p.Form, { model, rules, labelWidth: 120 }, () => [
          field('short', '短'),
          field('long', '很长的标签'),
          field('async', '异步'),
        ]),
      ])
  },
}

createApp(Probe).mount('#app')
