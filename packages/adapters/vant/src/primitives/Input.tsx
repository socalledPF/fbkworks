import { defineComponent, type PropType } from 'vue'
import { Field } from 'vant'
import type { InputProps } from '@fbkworks/adapter-core'

export const Input = defineComponent({
  name: 'FbkVantInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    type: { type: String as PropType<InputProps['type']>, default: 'text' },
    placeholder: String,
    disabled: Boolean,
    readonly: Boolean,
    clearable: { type: Boolean, default: true },
    rows: Number,
    size: String,
  },
  emits: ['update:modelValue', 'change', 'blur', 'focus'],
  setup(props, { attrs, emit, slots }) {
    return () => (
      <Field
        {...attrs}
        modelValue={String(props.modelValue ?? '')}
        type={props.type === 'password' ? 'password' : props.type === 'number' ? 'digit' : 'text'}
        rows={props.type === 'textarea' ? (props.rows ?? 3) : undefined}
        autosize={props.type === 'textarea'}
        clearable={props.clearable}
        readonly={props.readonly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onUpdate:modelValue={(value: string) => emit('update:modelValue', value)}
        /* change 以前只在 emits 里声明、从不 emit（element-plus / naive-ui 都发）。
           DOM 的 change 会从内层 input 冒泡上来，所以在 van-field 上挂一个监听即可。
           van-field 的 props 类型里没有 onChange，用展开 + as any 挂上去（运行时就是普通 DOM 监听）。 */
        {...({
          onChange: (event: Event) => emit('change', event),
        } as Record<string, unknown>)}
        onBlur={(event: Event) => emit('blur', event)}
        onFocus={(event: Event) => emit('focus', event)}
        v-slots={slots}
      />
    )
  },
})
