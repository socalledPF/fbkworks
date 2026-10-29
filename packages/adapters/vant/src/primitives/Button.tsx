import { computed, defineComponent, type PropType } from 'vue'
import { Button as VanButton } from 'vant'
import type { ButtonProps, Size, Status } from '@fbkworks/adapter-core'

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'primary',
  default: 'default',
} as const

export const Button = defineComponent({
  name: 'FbkVantButton',
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
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'normal'))
    return () => (
      <VanButton
        {...attrs}
        type={type.value}
        size={size.value}
        disabled={props.disabled}
        loading={props.loading}
        block={props.block}
        nativeType={props.nativeType}
        plain={props.variant === 'dashed'}
        onClick={(event: MouseEvent) => emit('click', event)}
        v-slots={slots}
      />
    )
  },
})
