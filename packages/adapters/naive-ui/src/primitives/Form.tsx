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
        return result === true || result === undefined
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
    required: Boolean,
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
