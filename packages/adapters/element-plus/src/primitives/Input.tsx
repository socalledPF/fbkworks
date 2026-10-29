import { computed, defineComponent, type PropType } from 'vue'
import { ElInput } from 'element-plus'
import type { InputProps, Size } from '@fbkworks/adapter-core'
import { toElementSize } from '../size'

export const Input = defineComponent({
  name: 'FbkElInput',
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
    const size = computed(() => toElementSize(props.size))
    return () => (
      <ElInput
        {...attrs}
        modelValue={props.modelValue}
        type={props.type === 'textarea' ? 'textarea' : props.type}
        size={size.value}
        rows={props.rows}
        clearable={props.clearable}
        disabled={props.disabled}
        readonly={props.readonly}
        placeholder={props.placeholder}
        onUpdate:modelValue={(value: string) => emit('update:modelValue', value)}
        onChange={(value: string) => emit('change', value)}
        onBlur={(event: FocusEvent) => emit('blur', event)}
        onFocus={(event: FocusEvent) => emit('focus', event)}
        v-slots={slots}
      />
    )
  },
})
