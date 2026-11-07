import type { AdapterName } from './adapters'
import { adapters } from './adapters'
import './styles'
import { createApp, h, reactive } from 'vue'
/* 仅 ?raw=1 诊断模式使用：绕开适配器直接对照原生行为 */
import { ElForm as EpForm, ElFormItem as EpFormItem, ElInput as EpInput } from 'element-plus'

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
 *
 * 诊断模式（排查 element-plus 的 required 规则不生效时用到，保留以便复现）：
 *   ?adapter=xxx                走适配器（默认）
 *   ?raw=1                      绕开适配器，直接用原生 ElForm/ElFormItem/ElInput
 *   ?raw=1&mapped=1             原生 EP + 适配器映射后的规则形状
 *   ?adapter=xxx&input=raw      适配器的 Form/FormItem + 原生 ElInput
 *
 * 已用它们把问题定位到 Form/FormItem 适配层（详见脚本头部「已知失败」）：
 *   · async-validator 接受我们的规则形状（单独验证过）
 *   · 规则确实传到了 ElForm（临时 data 属性验证过）
 *   · 原生 EP + 同样规则 → 正常报错
 *   · 适配器 Form/FormItem + 原生 ElInput → 仍然不报错
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
      rawInput
        ? h(EpInput, {
            modelValue: model[key as keyof typeof model],
            'onUpdate:modelValue': (value: string) => {
              model[key as keyof typeof model] = value
            },
          })
        : h(p.Input, {
            modelValue: model[key as keyof typeof model],
            'onUpdate:modelValue': (value: string) => {
              model[key as keyof typeof model] = value
            },
          }),
    ),
  ])

/* `?raw=1`：绕开适配器，直接用原生 element-plus 渲染同样的规则 ——
   用来把「适配器的问题」和「EP 本身的行为」分开。仅用于诊断。 */
const raw = params.get('raw') === '1'
/* `&mapped=1`：原生 EP + **适配器映射后的规则形状**，用来判断映射本身有没有破坏 EP 的识别 */
const rawMapped = params.get('mapped') === '1'
/* `&input=raw`：在**我们的** Form/FormItem 里换成原生 ElInput，
   用来判断问题在 Input 包装层还是 Form/FormItem 适配层 */
const rawInput = params.get('input') === 'raw'

const Probe = {
  name: 'FbkFormProbe',
  setup() {
    if (raw) {
      return () =>
        h('div', { 'data-fbk-probe': 'forms', 'data-adapter': 'raw-element-plus' }, [
          h(
            EpForm,
            {
              model,
              rules: {
                short: [
                  rawMapped
                    ? {
                        required: true,
                        type: undefined,
                        min: undefined,
                        max: undefined,
                        len: undefined,
                        pattern: undefined,
                        message: 'PROBE_REQUIRED_SHORT',
                        trigger: 'blur',
                        validator: undefined,
                      }
                    : { required: true, message: 'PROBE_REQUIRED_SHORT', trigger: 'blur' },
                ],
              },
              labelWidth: 120,
            },
            () =>
              h('div', { 'data-probe-field': 'short' }, [
                h(
                  EpFormItem,
                  { prop: 'short', label: '短' },
                  () => h(EpInput, { modelValue: model.short }),
                ),
              ]),
          ),
        ])
    }
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
