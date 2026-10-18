import { computed, defineComponent, type PropType } from 'vue'
import { NSelect } from 'naive-ui'
import type { SelectOption, SelectProps, Size } from '@fbk/adapter-core'

export const Select = defineComponent({
  name: 'FbkNaiveSelect',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number, Array] as PropType<SelectProps['modelValue']>, default: undefined },
    options: { type: Array as PropType<SelectOption[]>, default: () => [] },
    multiple: Boolean,
    filterable: Boolean,
    clearable: { type: Boolean, default: true },
    placeholder: String,
    title: String,
    size: { type: String as PropType<Size>, default: 'md' },
    disabled: Boolean,
    loading: Boolean,
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit }) {
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))
    return () => (
      <NSelect
        {...attrs}
        value={props.modelValue ?? null}
        options={props.options as any}
        multiple={props.multiple}
        filterable={props.filterable}
        clearable={props.clearable}
        placeholder={props.placeholder}
        size={size.value}
        disabled={props.disabled || props.loading}
        // naive-ui 的 on-change 已废弃；update:value 只在用户选择时触发，
        // 用它同时派发契约要求的 update:modelValue 与 change。
        onUpdate:value={(value: unknown) => {
          emit('update:modelValue', value)
          emit('change', value)
        }}
      />
    )
  },
})
