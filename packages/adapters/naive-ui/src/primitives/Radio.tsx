import { computed, defineComponent, type PropType } from 'vue'
import { NRadioGroup, NRadio } from 'naive-ui'
import type { RadioProps, Size } from '@fbkworks/adapter-core'

const sizeOf = { sm: 'small', md: 'medium', lg: 'large' } as const

/** 单选组。naive 用 `value` 而不是 modelValue，事件是 `update:value`。 */
export const Radio = defineComponent({
  name: 'FbkNaiveRadio',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number | null>, default: undefined },
    options: { type: Array as PropType<RadioProps['options']>, default: () => [] },
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit }) {
    const size = computed(() => sizeOf[props.size ?? 'md'])
    return () => (
      <NRadioGroup
        {...attrs}
        value={props.modelValue ?? null}
        disabled={props.disabled}
        size={size.value}
        onUpdate:value={(value: string | number) => {
          emit('update:modelValue', value)
          emit('change', value)
        }}
      >
        {props.options.map((option) => (
          <NRadio key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </NRadio>
        ))}
      </NRadioGroup>
    )
  },
})
