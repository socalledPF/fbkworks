import { computed, defineComponent, type PropType } from 'vue'
import { ElOption, ElSelect } from 'element-plus'
import type { SelectOption, SelectProps, Size } from '@fbk/adapter-core'
import { toElementSize } from '../size'

export const Select = defineComponent({
  name: 'FbkElSelect',
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
    const size = computed(() => toElementSize(props.size))
    return () => (
      <ElSelect
        {...attrs}
        modelValue={props.modelValue ?? undefined}
        multiple={props.multiple}
        filterable={props.filterable}
        clearable={props.clearable}
        placeholder={props.placeholder}
        size={size.value}
        disabled={props.disabled || props.loading}
        onUpdate:modelValue={(value: unknown) => emit('update:modelValue', value)}
        onChange={(value: unknown) => emit('change', value)}
      >
        {props.options.map((option) => (
          <ElOption
            key={String(option.value)}
            label={option.label}
            value={option.value}
            disabled={option.disabled}
          />
        ))}
      </ElSelect>
    )
  },
})
