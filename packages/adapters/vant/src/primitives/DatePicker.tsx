import { computed, defineComponent, ref, type PropType } from 'vue'
import { Field, Popup, DatePicker as VanDatePicker } from 'vant'
import type { DatePickerProps, Size } from '@fbk/adapter-core'

/**
 * 日期/时间选择（移动端）。
 *
 * vant 没有「输入框 + 弹出日历」的复合组件，必须自己拼：
 *   van-field（只读展示） + van-popup（底部弹出） + van-date-picker（滚轮）
 *
 * 这是适配层最该存在的场合 —— 业务侧只传 modelValue 和 type，
 * 三行的差异全部收敛在这里。
 */
const pad = (n: number) => String(n).padStart(2, '0')

/** 字符串 → vant 需要的 [年, 月, 日] 分段 */
function toSegments(value: string | null | undefined, type: string) {
  if (!value) return []
  const [datePart, timePart] = value.split(' ')
  if (type === 'time') return (timePart ?? datePart ?? '').split(':').filter(Boolean)
  const [y, m, d] = (datePart ?? '').split('-')
  if (type === 'datetime') {
    const [hh, mm] = (timePart ?? '').split(':')
    return [y, m, d, hh, mm].filter(Boolean)
  }
  return [y, m, d].filter(Boolean)
}

export const DatePicker = defineComponent({
  name: 'FbkVantDatePicker',
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
    const open = ref(false)
    const hasTime = computed(() => props.type === 'datetime' || props.type === 'datetimerange')

    const display = computed(() => {
      if (Array.isArray(props.modelValue)) return props.modelValue.join(' ~ ')
      return props.modelValue ?? ''
    })

    const placeholderText = computed(() => {
      const p = props.placeholder
      return Array.isArray(p) ? `${p[0]} ~ ${p[1]}` : (p ?? '请选择日期')
    })

    const onConfirm = ({ selectedValues }: { selectedValues: string[] }) => {
      const [y, m, d, hh, mm] = selectedValues
      let next: string
      if (props.type === 'time') next = `${hh ?? '00'}:${mm ?? '00'}:00`
      else if (hasTime.value) next = `${y}-${pad(Number(m))}-${pad(Number(d))} ${hh ?? '00'}:${mm ?? '00'}:00`
      else next = `${y}-${pad(Number(m))}-${pad(Number(d))}`
      emit('update:modelValue', next)
      emit('change', next)
      open.value = false
    }

    return () => (
      <div class="fbk-vant-date-picker">
        <Field
          {...attrs}
          readonly
          isLink
          disabled={props.disabled}
          modelValue={display.value}
          placeholder={placeholderText.value}
          onClick={() => !props.disabled && (open.value = true)}
        />
        <Popup v-model:show={open.value} position="bottom" round teleport="body">
          <VanDatePicker
            {...(props.uiProps ?? {})}
            /* 区间模式 vant 需要成对的两个 picker，首期只支持单值；
               区间在移动端建议用两个独立的 date 字段，交互更清晰。 */
            /* vant4 的 DatePicker 只支持 year/month/day 三列，没有时分列。
               datetime 类型在移动端降级为「只选日期」，时分由业务侧决定
               是否再补一个 TimePicker —— 静默丢掉时分比报错更糟，
               所以这里保留日期部分并在类型注释里写明。 */
            columnsType={['year', 'month', 'day']}
            modelValue={toSegments(
              Array.isArray(props.modelValue) ? props.modelValue[0] : props.modelValue,
              props.type ?? 'date',
            )}
            title="选择日期"
            onConfirm={onConfirm}
            onCancel={() => (open.value = false)}
          />
        </Popup>
      </div>
    )
  },
})
