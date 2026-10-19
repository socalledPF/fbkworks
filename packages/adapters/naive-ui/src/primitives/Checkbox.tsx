import { defineComponent, type PropType } from 'vue'
import { NCheckbox } from 'naive-ui'
import type { CheckboxProps, Size } from '@fbk/adapter-core'

/**
 * 布尔开关。
 *
 * 注意：naive 的 NCheckbox 单值模式用 `checked` 而不是 `modelValue`，
 * 事件名是 `update:checked`。直接用 v-model 会静默不生效 ——
 * 控件看起来在，但勾了没反应。
 *
 * 另外 naive 的 `size` 是 'small' | 'medium' | 'large' 这种档位名，
 * 不是像素值；字号对齐交给样式层，这里只映射档位。
 */
const sizeOf = { sm: 'small', md: 'medium', lg: 'large' } as const

export const Checkbox = defineComponent({
  name: 'FbkNaiveCheckbox',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    label: String,
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit, slots }) {
    const forward = (value: boolean) => {
      emit('update:modelValue', value)
      emit('change', value)
    }

    return () => (
      <NCheckbox
        {...attrs}
        checked={props.modelValue}
        disabled={props.disabled}
        size={sizeOf[props.size ?? 'md']}
        onUpdate:checked={forward}
      >
        {slots.default?.() ?? props.label}
      </NCheckbox>
    )
  },
})
