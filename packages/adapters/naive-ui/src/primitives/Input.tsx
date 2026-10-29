import { computed, defineComponent, type PropType } from 'vue'
import { NInput } from 'naive-ui'
import type { InputProps, Size } from '@fbkworks/adapter-core'

export const Input = defineComponent({
  name: 'FbkNaiveInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    type: { type: String as PropType<InputProps['type']>, default: 'text' },
    placeholder: String,
    disabled: Boolean,
    readonly: Boolean,
    clearable: { type: Boolean, default: true },
    rows: Number,
    size: { type: String as PropType<Size>, default: 'md' },
  },
  emits: ['update:modelValue', 'change', 'blur', 'focus'],
  setup(props, { attrs, emit, slots }) {
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))
    const type = computed(() =>
      props.type === 'number' ? 'text' : props.type === 'textarea' ? 'textarea' : props.type,
    )
    return () => (
      <NInput
        {...attrs}
        value={props.modelValue as string}
        type={type.value as any}
        size={size.value}
        rows={props.rows}
        autosize={props.type === 'textarea' ? { minRows: props.rows ?? 3 } : undefined}
        clearable={props.clearable}
        disabled={props.disabled}
        readonly={props.readonly}
        placeholder={props.placeholder}
        onUpdate:value={(value: string) => emit('update:modelValue', value)}
        onChange={(value: string) => emit('change', value)}
        onBlur={(event: FocusEvent) => emit('blur', event)}
        onFocus={(event: FocusEvent) => emit('focus', event)}
        v-slots={slots}
      />
    )
  },
})
