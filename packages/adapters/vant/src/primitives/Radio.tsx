import { defineComponent, type PropType } from 'vue'
import { RadioGroup, Radio as VanRadio } from 'vant'
import type { RadioProps, Size } from '@fbkworks/adapter-core'

/** 单选组（移动端）。vant 的 RadioGroup 用 `modelValue` + `update:modelValue`。 */
export const Radio = defineComponent({
  name: 'FbkVantRadio',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number | null>, default: undefined },
    options: { type: Array as PropType<RadioProps['options']>, default: () => [] },
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit }) {
    return () => (
      <RadioGroup
        {...attrs}
        modelValue={props.modelValue ?? null}
        disabled={props.disabled}
        iconSize={props.size === 'sm' ? 16 : props.size === 'lg' ? 22 : 18}
        onUpdate:modelValue={(value: string | number) => {
          emit('update:modelValue', value)
          emit('change', value)
        }}
      >
        {props.options.map((option) => (
          <VanRadio key={String(option.value)} name={option.value} disabled={option.disabled}>
            {option.label}
          </VanRadio>
        ))}
      </RadioGroup>
    )
  },
})
