import { defineComponent, ref, type PropType } from 'vue'
import { Form as VanForm, Field } from 'vant'
import type { FieldRule } from 'vant'
import type { FbkRule, FormProps } from '@fbkworks/adapter-core'

/**
 * vant 没有「按最宽标签统一」的能力。
 *
 * `labelWidth="auto"` 会被 vant 的 addUnit 原样写成 `width: auto`，
 * 而 .van-field__label 是 flex:none，`auto` 会让它重新按内容收缩 ——
 * 恰好是我们要避免的效果。所以这里把 `auto` 翻译成「不传」：
 * vant 的默认值 --van-field-label-width 是 6.2em，本来就对所有行一致。
 *
 * 换句话说：契约里的 `auto` 语义是「各行标签等宽」，
 * element-plus / naive-ui 用「量最宽的那个」实现，
 * vant 用「固定 em」实现。三者对调用方是同一个承诺。
 */
function toVantLabelWidth(width: string | number | undefined) {
  return width === 'auto' ? undefined : width
}

function toVantRules(rules: FbkRule[] | undefined) {
  if (!rules?.length) return undefined
  return rules.map((rule) => ({
    required: rule.required,
    pattern: rule.pattern,
    message: rule.message,
    trigger:
      rule.trigger === 'submit' || rule.trigger === undefined
        ? undefined
        : rule.trigger === 'change'
          ? 'onChange'
          : 'onBlur',
    validator:
      rule.validator &&
      ((value: unknown) => {
        const result = rule.validator!(value, {})
        if (result instanceof Promise) return result.then((message) => message === true || !message)
        return result === true || result === undefined
      }),
  }))
}

/**
 * van-form 没有命令式 validate() Promise。
 * 用 @submit / @failed 事件桥接，契约只承诺 validate(): Promise<true>。
 */
export const Form = defineComponent({
  name: 'FbkVantForm',
  props: {
    model: { type: Object as PropType<Record<string, any>>, required: true },
    rules: { type: Object as PropType<FormProps['rules']>, default: undefined },
    labelWidth: { type: [String, Number] as PropType<string | number>, default: undefined },
    labelPosition: { type: String as PropType<FormProps['labelPosition']>, default: 'right' },
    disabled: Boolean,
    size: String,
    scrollToError: Boolean,
  },
  setup(props, { expose, slots }) {
    // van-form 没有官方 TS 类型暴露 submit/resetValidation，但它们确实存在
    const formRef = ref<any>()
    let pending: { resolve: (value: true) => void; reject: (reason: unknown) => void } | null = null

    const validate = () =>
      new Promise<true>((resolve, reject) => {
        pending = { resolve, reject }
        formRef.value?.submit()
      })

    expose({
      validate,
      validateField: async () => true as const,
      resetFields: () => formRef.value?.resetValidation(),
      clearValidate: () => formRef.value?.resetValidation(),
    })

    return () => (
      <VanForm
        ref={formRef}
        labelWidth={toVantLabelWidth(props.labelWidth)}
        labelAlign={props.labelPosition === 'top' ? 'top' : props.labelPosition === 'left' ? 'left' : 'right'}
        disabled={props.disabled}
        onSubmit={() => {
          pending?.resolve(true)
          pending = null
        }}
        onFailed={(errors: unknown) => {
          pending?.reject(errors)
          pending = null
        }}
      >
        {slots.default?.()}
      </VanForm>
    )
  },
})

export const FormItem = defineComponent({
  name: 'FbkVantFormItem',
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
      <Field
        name={props.prop}
        label={props.label}
        required={props.required}
        rules={toVantRules(props.rules) as FieldRule[] | undefined}
        labelWidth={toVantLabelWidth(props.labelWidth)}
        v-slots={{ input: slots.default, default: slots.default }}
      >
        {props.help ? <div class="fbk-form-item__help">{props.help}</div> : null}
      </Field>
    )
  },
})
