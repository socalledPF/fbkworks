import { computed, defineComponent, type PropType } from 'vue'
import { NButton } from 'naive-ui'
import type { ButtonProps, Size, Status } from '@fbk/adapter-core'

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
