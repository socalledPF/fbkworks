import { defineComponent, type PropType } from 'vue'
import { ElCheckbox } from 'element-plus'
import type { Size } from '@fbkworks/adapter-core'
import { toElementSize } from '../size'

/**
 * 布尔开关。
 *
 * element-plus 的 ElCheckbox 把 label 放在勾选框右侧，正好是业务表单要的顺序，
 * 所以不需要额外包一层插槽。
 */
export const Checkbox = defineComponent({
  name: 'FbkElCheckbox',
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
      <ElCheckbox
        {...attrs}
        modelValue={props.modelValue}
        disabled={props.disabled}
        size={toElementSize(props.size)}
        label={props.label}
        onChange={(value: unknown) => {
          const next = Boolean(value)
          emit('update:modelValue', next)
          emit('change', next)
        }}
      >
        {slots.default?.()}
      </ElCheckbox>
    )
  },
})
