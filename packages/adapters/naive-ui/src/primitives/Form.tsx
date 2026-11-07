import { computed, defineComponent, ref, type PropType } from 'vue'
import { NForm, NFormItem, type FormInst, type FormRules } from 'naive-ui'
import type { FbkRule, FormProps, Size } from '@fbkworks/adapter-core'

function toNaiveRules(rules: FbkRule[] | undefined): FormRules | undefined {
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
        const result = await rule.validator!(value, {})
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
        Object.entries(props.rules).map(([key, rules]) => [key, toNaiveRules(rules)]),
      ) as FormRules
    })
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))

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
      resetFields: () => formRef.value?.restoreValidation(),
      clearValidate: () => formRef.value?.restoreValidation(),
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
    span: Number,
  },
  setup(props, { slots }) {
    return () => (
      <NFormItem
        label={props.label}
        path={props.prop}
        required={props.required}
        rule={toNaiveRules(props.rules)}
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
