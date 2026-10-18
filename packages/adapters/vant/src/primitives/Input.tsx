import { defineComponent, type PropType } from 'vue'
import { Field } from 'vant'
import type { InputProps } from '@fbk/adapter-core'

export const Input = defineComponent({
  name: 'FbkVantInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    type: { type: String as PropType<InputProps['type']>, default: 'text' },
    placeholder: String,
    disabled: Boolean,
    readonly: Boolean,
    clearable: { type: Boolean, default: true },
    rows: Number,
    size: String,
  },
  emits: ['update:modelValue', 'change', 'blur', 'focus'],
  setup(props, { attrs, emit, slots }) {
    return () => (
      <Field
        {...attrs}
        modelValue={String(props.modelValue ?? '')}
        type={props.type === 'password' ? 'password' : props.type === 'number' ? 'digit' : 'text'}
        rows={props.type === 'textarea' ? (props.rows ?? 3) : undefined}
        autosize={props.type === 'textarea'}
        clearable={props.clearable}
        readonly={props.readonly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onUpdate:modelValue={(value: string) => emit('update:modelValue', value)}
        onBlur={(event: Event) => emit('blur', event)}
        onFocus={(event: Event) => emit('focus', event)}
        v-slots={slots}
      />
    )
  },
})
