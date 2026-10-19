import { defineComponent, type PropType } from 'vue'
import { Checkbox as VanCheckbox } from 'vant'
import type { CheckboxProps, Size } from '@fbk/adapter-core'

/**
 * 布尔开关。
 *
 * vant 的 Checkbox 是 `modelValue` 双向的，但它的 label 位置固定在勾选框左侧，
 * 而业务表单里开关文案通常在右侧 —— 这里用插槽显式包一层 <span>，
 * 保证三个适配器下「勾选框在左、文字在右」的顺序一致。
 */
export const Checkbox = defineComponent({
  name: 'FbkVantCheckbox',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    label: String,
    disabled: Boolean,
    size: { type: String as PropType<Size>, default: 'md' },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit, slots }) {
    return () => (
      <VanCheckbox
        {...attrs}
        modelValue={props.modelValue}
        disabled={props.disabled}
        iconSize={props.size === 'sm' ? 16 : props.size === 'lg' ? 22 : 18}
        onUpdate:modelValue={(value: boolean) => {
          emit('update:modelValue', value)
          emit('change', value)
        }}
        v-slots={{
          default: () =>
            slots.default?.() ?? (props.label ? <span class="fbk-checkbox__label">{props.label}</span> : null),
        }}
      />
    )
  },
})
