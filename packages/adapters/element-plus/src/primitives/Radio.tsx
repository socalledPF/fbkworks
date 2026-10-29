import { defineComponent, type PropType } from 'vue'
import { ElRadioGroup, ElRadio } from 'element-plus'
import type { RadioProps, Size } from '@fbkworks/adapter-core'
import { toElementSize } from '../size'

/** 单选组。与 Select 的区别是选项全部可见，适合 2-4 个枚举值。 */
export const Radio = defineComponent({
  name: 'FbkElRadio',
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
      <ElRadioGroup
        {...attrs}
        modelValue={props.modelValue ?? undefined}
        disabled={props.disabled}
        size={toElementSize(props.size)}
        onUpdate:modelValue={(value: string | number | boolean | undefined) => {
          // 取消选中时 element 会传 undefined，契约里用 null 表示空
          const next = value === undefined ? null : (value as string | number)
          emit('update:modelValue', next)
          emit('change', next)
        }}
      >
        {props.options.map((option) => (
          <ElRadio key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </ElRadio>
        ))}
      </ElRadioGroup>
    )
  },
})
