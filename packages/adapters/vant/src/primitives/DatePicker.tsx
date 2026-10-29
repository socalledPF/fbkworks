import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { Field, Popup, DatePicker as VanDatePicker } from 'vant'
import { warnOnce } from '@fbkworks/shared'
import type { DatePickerProps, DatePickerType, Size } from '@fbkworks/adapter-core'

/**
 * 日期选择（移动端）。只有 type="date" 真正可用。
 *
 * vant 没有「输入框 + 弹出日历」的复合组件，必须自己拼：
 *   van-field（只读展示） + van-popup（底部弹出） + van-date-picker（滚轮）
 *
 * 但 vant4 的滚轮只有 year/month/day 三列，也没有成对选区的形态。
 * 撑不住的 type 一律显式拒绝而不是降级：降级时用户看到「选好了」，
 * 落库的却是 00:00:00 或被压成单值的区间 —— 静默改写数据比报错糟得多。
 */
const pad = (n: number) => String(n).padStart(2, '0')

type UnsupportedType = Exclude<DatePickerType, 'date'>

const UNSUPPORTED_REASON: Record<UnsupportedType, string> = {
  time: '滚轮没有时分列，确认时只能把时间补成 00:00:00',
  datetime: '滚轮没有时分列，确认时只能把用户选的时分清零',
  daterange: '当前实现没有成对选区间的滚轮，确认只能 emit 单值，与 string[] 契约不符',
  datetimerange: '既没有时分列也没有成对区间，确认会同时丢掉时分和区间',
}

/** 字符串 → vant 需要的 [年, 月, 日] 分段（只处理单值日期） */
function toSegments(value: string | null | undefined) {
  if (!value) return []
  const [y, m, d] = value.split(' ')[0].split('-')
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

    /** undefined = 可用；有值 = 该类型的拒绝原因 */
    const unsupported = computed<string | undefined>(() => {
      const type = props.type ?? 'date'
      return type === 'date' ? undefined : UNSUPPORTED_REASON[type]
    })

    /** 挂载即告警：业务方一进页面就该知道这个字段不会产出值，而不是等用户点开。 */
    watch(
      () => props.type,
      () => {
        const reason = unsupported.value
        if (!reason) return
        warnOnce(
          `vant-date-picker:${props.type}`,
          `DatePicker 在移动端不支持 type="${props.type}"：${reason}。` +
            '该字段已置为不可用，不会 emit 任何值；单日期请用 type="date"，区间请用两个独立的日期字段。',
        )
      },
      { immediate: true },
    )

    const display = computed(() => {
      if (Array.isArray(props.modelValue)) return props.modelValue.join(' ~ ')
      return props.modelValue ?? ''
    })

    const placeholderText = computed(() => {
      if (unsupported.value) return `移动端不支持 type="${props.type}"`
      const p = props.placeholder
      return Array.isArray(p) ? `${p[0]} ~ ${p[1]}` : (p ?? '请选择日期')
    })

    const onConfirm = ({ selectedValues }: { selectedValues: string[] }) => {
      // 滚轮只挂在 type="date" 下，这里再兜一次：type 中途变更也不会漏出错误值
      if (unsupported.value) return
      const [y, m, d] = selectedValues
      const next = `${y}-${pad(Number(m))}-${pad(Number(d))}`
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
          disabled={props.disabled || Boolean(unsupported.value)}
          modelValue={display.value}
          placeholder={placeholderText.value}
          onClick={() => {
            if (props.disabled || unsupported.value) return
            open.value = true
          }}
        />
        {/* 拒绝态不挂弹层：滚轮不存在，就不存在「点了确认拿到值」的路径 */}
        {unsupported.value ? null : (
          <Popup v-model:show={open.value} position="bottom" round teleport="body">
            <VanDatePicker
              {...(props.uiProps ?? {})}
              columnsType={['year', 'month', 'day']}
              modelValue={toSegments(props.modelValue as string | null | undefined)}
              title="选择日期"
              onConfirm={onConfirm}
              onCancel={() => (open.value = false)}
            />
          </Popup>
        )}
      </div>
    )
  },
})
