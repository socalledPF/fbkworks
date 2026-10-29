import { computed, defineComponent, type PropType } from 'vue'
import { NButton } from 'naive-ui'
import type { ButtonProps, Size, Status } from '@fbkworks/adapter-core'

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  default: 'default',
} as const

export const Button = defineComponent({
  name: 'FbkNaiveButton',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<ButtonProps['variant']>, default: 'default' },
    status: { type: String as PropType<Status>, default: undefined },
    size: { type: String as PropType<Size>, default: 'md' },
    disabled: Boolean,
    loading: Boolean,
    block: Boolean,
    nativeType: { type: String as PropType<ButtonProps['nativeType']>, default: 'button' },
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    const type = computed(() => (props.status ? statusType[props.status] : props.variant === 'primary' ? 'primary' : 'default'))
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))
    const text = computed(() => props.variant === 'text' || props.variant === 'link')
    const dashed = computed(() => props.variant === 'dashed')
    return () => (
      <NButton
        {...attrs}
        /* naive 的 text 模式**不产生任何 class**（Button.mjs 的 class 拼接里
           只有 dashed / ghost / secondary 等会加类名，text 不加）。
           样式层因此没法用 .n-button--text 选中它，文字按钮只剩行高
           （实测 12px vs element-plus 的 32px）。
           这里补一个自己的标记类，由 style.css 补回控件高度。 */
        class={[text.value ? 'fbk-button--text' : null, attrs.class]}
        type={type.value}
        size={size.value}
        disabled={props.disabled}
        loading={props.loading}
        block={props.block}
        attrType={props.nativeType}
        text={text.value}
        dashed={dashed.value}
        onClick={(event: MouseEvent) => emit('click', event)}
        v-slots={slots}
      />
    )
  },
})
