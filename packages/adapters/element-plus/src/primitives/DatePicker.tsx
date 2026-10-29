import { computed, defineComponent, type PropType } from 'vue'
import { ElDatePicker } from 'element-plus'
import type { DatePickerProps, Size } from '@fbkworks/adapter-core'
import { toElementSize } from '../size'

/**
 * 日期/时间选择。
 *
 * 值统一用字符串（YYYY-MM-DD / YYYY-MM-DD HH:mm:ss / HH:mm:ss），
 * element-plus 原生支持字符串 v-model，直接用 `value-format` 约束输出格式即可，
 * 不需要在适配器里做 Date 互转。
 */
const VALUE_FORMAT: Record<string, string> = {
  date: 'YYYY-MM-DD',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  time: 'HH:mm:ss',
  daterange: 'YYYY-MM-DD',
  datetimerange: 'YYYY-MM-DD HH:mm:ss',
}

export const DatePicker = defineComponent({
  name: 'FbkElDatePicker',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Array] as PropType<string | string[] | null>, default: undefined },
    type: { type: String as PropType<DatePickerProps['type']>, default: 'date' },
    placeholder: { type: [String, Array] as PropType<string | [string, string]>, default: undefined },
    disabled: Boolean,
    clearable: { type: Boolean, default: true },
    size: { type: String as PropType<Size>, default: 'md' },
    uiProps: { type: Object as PropType<Record<string, any>>, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit, slots }) {
    const isRange = computed(() => props.type === 'daterange' || props.type === 'datetimerange')

    return () => (
      <ElDatePicker
        {...attrs}
        {...(props.uiProps ?? {})}
        modelValue={props.modelValue ?? (isRange.value ? null : '')}
        /* element-plus 的 type 枚举里没有 'time'（纯时间用 ElTimePicker）。
           这里把 time 映射成 datetime 面板，并靠 format 只显示时分 —— 
           与 naive 适配器保持同一策略，三边行为一致。 */
        type={(props.type === 'time' ? 'datetime' : props.type) as any}
        valueFormat={VALUE_FORMAT[props.type ?? 'date']}
        placeholder={Array.isArray(props.placeholder) ? undefined : props.placeholder}
        disabled={props.disabled}
        clearable={props.clearable}
        size={toElementSize(props.size)}
        startPlaceholder={isRange.value ? '开始日期' : undefined}
        endPlaceholder={isRange.value ? '结束日期' : undefined}
        rangeSeparator="至"
        onUpdate:modelValue={(value: string | string[] | null) => {
          emit('update:modelValue', value)
          emit('change', value)
        }}
        v-slots={slots}
      />
    )
  },
})
