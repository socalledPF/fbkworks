import { computed, defineComponent, ref, type PropType } from 'vue'
import { ElForm, ElFormItem, type FormInstance } from 'element-plus'
import type { FormProps, FbkRule, Size } from '@fbk/adapter-core'
import { toElementSize } from '../size'

function toElementRules(rules: FbkRule[] | undefined) {
  if (!rules?.length) return undefined
  return rules.map((rule) => ({
    required: rule.required,
    type: rule.type,
    min: rule.min,
    max: rule.max,
    len: rule.len,
    pattern: rule.pattern,
    message: rule.message,
    trigger: rule.trigger === 'submit' ? undefined : (rule.trigger ?? 'change'),
    validator:
      rule.validator &&
      ((_r: unknown, value: unknown, callback: (error?: Error) => void) => {
        const result = rule.validator!(value, {})
        if (result instanceof Promise) {
          result.then((message) => (message === true || !message ? callback() : callback(new Error(message))))
          return
        }
        if (result === true || result === undefined) callback()
        else callback(new Error(result))
      }),
  }))
}

export const Form = defineComponent({
  name: 'FbkElForm',
  props: {
    model: { type: Object as PropType<Record<string, any>>, required: true },
    rules: { type: Object as PropType<FormProps['rules']>, default: undefined },
    labelWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
    labelPosition: { type: String as PropType<FormProps['labelPosition']>, default: 'right' },
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
    scrollToError: { type: Boolean, default: true },
  },
  setup(props, { expose, slots }) {
    const formRef = ref<FormInstance>()
    const elementRules = computed(() => {
      if (!props.rules) return undefined
      return Object.fromEntries(
        Object.entries(props.rules).map(([key, rules]) => [key, toElementRules(rules)]),
      )
    })

    expose({
      validate: async () => {
        const result = await formRef.value?.validate()
        return (result ?? true) as true
      },
      validateField: async (prop: string | string[]) => {
        await formRef.value?.validateField(prop)
        return true as const
      },
      resetFields: () => formRef.value?.resetFields(),
      clearValidate: (props?: string | string[]) => formRef.value?.clearValidate(props),
    })

    return () => (
      <ElForm
        ref={formRef}
        model={props.model}
        rules={elementRules.value}
        labelWidth={props.labelWidth}
        labelPosition={props.labelPosition}
        disabled={props.disabled}
        size={toElementSize(props.size)}
        scrollToError={props.scrollToError}
      >
        {slots.default?.()}
      </ElForm>
    )
  },
})

export const FormItem = defineComponent({
  name: 'FbkElFormItem',
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
      <ElFormItem
        label={props.label}
        prop={props.prop}
        required={props.required}
        rules={toElementRules(props.rules)}
        labelWidth={props.labelWidth}
      >
        {slots.default?.()}
        {props.help ? <div class="fbk-form-item__help">{props.help}</div> : null}
      </ElFormItem>
    )
  },
})
