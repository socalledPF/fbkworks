import { computed, defineComponent, type PropType } from 'vue'
import { ElButton } from 'element-plus'
import type { ButtonProps, Size, Status } from '@fbk/adapter-core'
import { toElementSize } from '../size'

const variantType: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | ''> = {
  primary: 'primary',
  default: '',
  dashed: 'primary',
  text: 'primary',
  link: 'primary',
}

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  default: '',
} as const

export const Button = defineComponent({
  name: 'FbkElButton',
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
    const type = computed(() => (props.status ? statusType[props.status] : variantType[props.variant ?? 'default']))
    const plain = computed(() => props.variant === 'dashed')
    const text = computed(() => props.variant === 'text')
    const link = computed(() => props.variant === 'link')

    return () => (
      <ElButton
        {...attrs}
        type={type.value}
        size={toElementSize(props.size)}
        disabled={props.disabled}
        loading={props.loading}
        plain={plain.value}
        text={text.value}
        link={link.value}
        nativeType={props.nativeType}
        style={props.block ? { width: '100%', ...((attrs.style as object) ?? {}) } : attrs.style}
        onClick={(event: MouseEvent) => emit('click', event)}
        v-slots={slots}
      />
    )
  },
})
