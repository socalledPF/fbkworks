import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  type InjectionKey,
  type PropType,
} from 'vue'
import { NForm, NFormItem, type FormInst, type FormRules } from 'naive-ui'
import type { FbkRule, FormProps, Size } from '@fbkworks/adapter-core'
import { warnOnce } from '@fbkworks/shared'

/**
 * ⑦ Form 把 model 的 **getter** 交给子孙 FormItem。
 *
 * 契约（adapter-core/contracts/form.ts 的 FbkRule.validator(value, model)）和文档
 * 都说 validator 的第二个参数是表单 model，但这里以前恒传 `{}` ——
 * 「两次密码一致」这类跨字段校验永远不成立。传 getter 而不是对象本身，
 * 是因为 model 允许被整体替换，校验时必须读到当下的那个。
 */
const FBK_FORM_MODEL: InjectionKey<() => Record<string, any>> = Symbol('fbk.naive.form.model')

/** ⑤ 按名清校验的登记簿：见 FBK_FORM_ITEMS 的注释 */
interface FbkFormItemHandle {
  prop: () => string | undefined
  restoreValidation: () => void
}

/**
 * ⑤ `NForm.restoreValidation()` 只能**全清**（naive-ui 没有按名 API），
 * 所以按名清理只能由 FormItem 登记自己的 restoreValidation，Form 按 prop 派发。
 * 跟 `clearValidate(names)` 一起构成三端一致的语义：传名清指定字段，不传清全部。
 */
const FBK_FORM_ITEMS: InjectionKey<{ register: (handle: FbkFormItemHandle) => () => void }> =
  Symbol('fbk.naive.form.items')

function toNaiveRules(rules: FbkRule[] | undefined, model?: Record<string, any>): FormRules | undefined {
  if (!rules?.length) return undefined
  return rules.map((rule) => ({
    required: rule.required,
    type: rule.type === 'date' ? 'number' : rule.type,
    min: rule.min,
    max: rule.max,
    len: rule.len,
    pattern: rule.pattern,
    message: rule.message,
    trigger: rule.trigger === 'submit' ? undefined : (rule.trigger ?? 'change'),
    validator:
      rule.validator &&
      (async (_r: unknown, value: unknown) => {
        const result = await rule.validator!(value, model ?? {})
        if (result === true || result === undefined) return true
        /* FbkRule 约定「validator 返回字符串 = 错误信息」。
           naive 的异步路径只认 **reject**：resolve 一个 Error 对象会被当成通过
           （实测表单项连状态类都不出现）。所以这里必须 throw。
           注意本函数是 async，throw 发生在 await 之后即为 Promise reject，
           不会落进 naive 外层那个同步 try/catch。 */
        throw new Error(String(result))
      }),
  })) as unknown as FormRules
}

export const Form = defineComponent({
  name: 'FbkNaiveForm',
  props: {
    model: { type: Object as PropType<Record<string, any>>, required: true },
    rules: { type: Object as PropType<FormProps['rules']>, default: undefined },
    labelWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
    labelPosition: { type: String as PropType<FormProps['labelPosition']>, default: 'left' },
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
    scrollToError: { type: Boolean, default: true },
  },
  setup(props, { expose, slots }) {
    const formRef = ref<FormInst>()
    const naiveRules = computed(() => {
      if (!props.rules) return undefined
      return Object.fromEntries(
        Object.entries(props.rules).map(([key, rules]) => [key, toNaiveRules(rules, props.model)]),
      ) as FormRules
    })
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))

    /* 登记簿不用 reactive：只在 clearValidate 的派发时刻读，不需要触发渲染。 */
    const items = new Set<FbkFormItemHandle>()
    provide(FBK_FORM_MODEL, () => props.model)
    provide(FBK_FORM_ITEMS, {
      register: (handle) => {
        items.add(handle)
        return () => {
          items.delete(handle)
        }
      },
    })

    expose({
      validate: async () => {
        await formRef.value?.validate()
        return true as const
      },
      validateField: async (prop: string | string[]) => {
        const props_ = Array.isArray(prop) ? prop : [prop]
        await formRef.value?.validate(undefined, (rule) => props_.includes(rule.key as string))
        return true as const
      },
      /* 契约里 resetFields = 清值 + 清校验，但 NForm 拿不到初始值，只能清校验。
         以前这里**静默**只清校验 —— 用户点「重置」看到输入值原样保留，以为按钮坏了。
         现在显式告警，并且把「只清校验」的正确入口 clearValidate 摆在旁边。 */
      resetFields: () => {
        warnOnce(
          'form.resetFields',
          'resetFields 在 naive-ui 上只能清校验：Form 拿不到初始值，清值请业务方重置 v-model；只清校验请用 clearValidate',
        )
        formRef.value?.restoreValidation()
      },
      /* 以前丢掉参数、一律全清 —— 传了名字的调用方以为只清了一个字段。 */
      clearValidate: (names?: string | string[]) => {
        if (!names) {
          formRef.value?.restoreValidation()
          return
        }
        const targets = Array.isArray(names) ? names : [names]
        items.forEach((item) => {
          const prop = item.prop()
          if (prop && targets.includes(prop)) item.restoreValidation()
        })
      },
    })

    return () => (
      <NForm
        ref={formRef}
        model={props.model}
        rules={naiveRules.value}
        labelWidth={props.labelWidth}
        labelPlacement={props.labelPosition === 'top' ? 'top' : props.labelPosition === 'right' ? 'left' : 'left'}
        labelAlign={props.labelPosition === 'right' ? 'right' : 'left'}
        disabled={props.disabled}
        size={size.value}
      >
        {slots.default?.()}
      </NForm>
    )
  },
})

export const FormItem = defineComponent({
  name: 'FbkNaiveFormItem',
  props: {
    label: String,
    prop: String,
    /* 必须显式给 default: undefined：写成裸 `Boolean` 时 Vue 会把「没传」强转成 false，
       进而覆盖/关闭 UI 库对规则里 required 的处理。element-plus 上已实测：
       表单级 { required: true } 被改成 false，空值校验静默通过。 */
    required: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    rules: { type: Array as PropType<FbkRule[]>, default: undefined },
    help: String,
    labelWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
  },
  setup(props, { slots }) {
    const formItemRef = ref<{ restoreValidation: () => void }>()
    /* 没有外层 Form（FormItem 被单独使用）时拿不到 model 与登记簿，
       model 退回 {}、按名清理无处登记 —— 都不抛错。 */
    const getModel = inject<(() => Record<string, any>) | null>(FBK_FORM_MODEL, null)
    const registry = inject<{ register: (handle: FbkFormItemHandle) => () => void } | null>(
      FBK_FORM_ITEMS,
      null,
    )
    let unregister: (() => void) | undefined

    onMounted(() => {
      unregister = registry?.register({
        prop: () => props.prop,
        restoreValidation: () => formItemRef.value?.restoreValidation(),
      })
    })
    onBeforeUnmount(() => unregister?.())

    return () => (
      <NFormItem
        ref={formItemRef}
        label={props.label}
        path={props.prop}
        required={props.required}
        rule={toNaiveRules(props.rules, getModel?.())}
        labelWidth={props.labelWidth}
      >
        {{
          default: slots.default,
          feedback: props.help ? () => <div class="fbk-form-item__help">{props.help}</div> : undefined,
        }}
      </NFormItem>
    )
  },
})
