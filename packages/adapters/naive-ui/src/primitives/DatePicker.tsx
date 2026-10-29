import { computed, defineComponent, type PropType } from 'vue'
import { NDatePicker } from 'naive-ui'
import type { DatePickerProps, Size } from '@fbkworks/adapter-core'

/**
 * 日期/时间选择。
 *
 * 与 element-plus 的关键差异：naive 的 NDatePicker **只接受时间戳（number）**，
 * 不接受字符串。所以这里必须做双向转换，否则 v-model 会静默失效
 * （控件显示为空、选择后拿不到值）。
 *
 * 转换只用本地时区，不做 UTC 换算 —— 业务侧传的是"用户看到的日期"。
 */
const pad = (n: number) => String(n).padStart(2, '0')

function toTimestamp(value: string | string[] | null | undefined): number | [number, number] | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) {
    const [start, end] = value
    const s = start ? new Date(start.replace(' ', 'T')).getTime() : null
    const e = end ? new Date(end.replace(' ', 'T')).getTime() : null
    return s !== null && e !== null ? [s, e] : null
  }
  const ts = new Date(value.replace(' ', 'T')).getTime()
  return Number.isNaN(ts) ? null : ts
}

function formatDate(ts: number, type: string): string {
  const d = new Date(ts)
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  if (type === 'time') return hms
  if (type === 'datetime' || type === 'datetimerange') return `${ymd} ${hms}`
  return ymd
}

const sizeOf = { sm: 'small', md: 'medium', lg: 'large' } as const

export const DatePicker = defineComponent({
  name: 'FbkNaiveDatePicker',
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
  setup(props, { attrs, emit }) {
    const isRange = computed(() => props.type === 'daterange' || props.type === 'datetimerange')
    const hasTime = computed(() => props.type === 'datetime' || props.type === 'datetimerange')
    const isTimeOnly = computed(() => props.type === 'time')

    const emitValue = (value: number | [number, number] | null) => {
      let next: string | string[] | null = null
      if (value === null) next = null
      else if (Array.isArray(value)) next = value.map((v) => formatDate(v, props.type!))
      else next = formatDate(value, props.type!)
      emit('update:modelValue', next)
      emit('change', next)
    }

    return () => (
      <NDatePicker
        {...attrs}
        {...(props.uiProps ?? {})}
        value={toTimestamp(props.modelValue)}
        /* naive 的 NDatePicker 没有 'time' 这一档，纯时间场景用 datetime 面板
           并靠 format 只显示时分（见 uiProps.format 约定）。
           强转类型是因为契约的 DatePickerType 比 naive 的枚举宽。 */
        type={
          (isRange.value
            ? hasTime.value
              ? 'datetimerange'
              : 'daterange'
            : isTimeOnly.value
              ? 'datetime'
              : hasTime.value
                ? 'datetime'
                : 'date') as any
        }
        clearable={props.clearable}
        disabled={props.disabled}
        size={sizeOf[props.size ?? 'md']}
        /* naive 的 range 模式用 start/end 占位符；单值用 placeholder */
        startPlaceholder={isRange.value ? (props.placeholder as [string, string])?.[0] ?? '开始日期' : undefined}
        endPlaceholder={isRange.value ? (props.placeholder as [string, string])?.[1] ?? '结束日期' : undefined}
        placeholder={isRange.value ? undefined : (props.placeholder as string)}
        onUpdate:value={emitValue}
      />
    )
  },
})
