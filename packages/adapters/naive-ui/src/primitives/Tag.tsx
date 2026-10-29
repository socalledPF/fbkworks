import { computed, defineComponent, type PropType } from 'vue'
import { NTag } from 'naive-ui'
import type { Size, Status } from '@fbkworks/adapter-core'

const statusType = {
  primary: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  default: 'default',
} as const

export const Tag = defineComponent({
  name: 'FbkNaiveTag',
  inheritAttrs: false,
  props: {
    status: { type: String as PropType<Status>, default: 'default' },
    size: { type: String as PropType<Size>, default: 'md' },
    closable: Boolean,
    bordered: Boolean,
  },
  emits: ['close'],
  setup(props, { attrs, emit, slots }) {
    const type = computed(() => statusType[props.status])
    const size = computed(() => (props.size === 'sm' ? 'small' : props.size === 'lg' ? 'large' : 'medium'))
    return () => (
      <NTag
        {...attrs}
        type={type.value}
        size={size.value}
        closable={props.closable}
        bordered={props.bordered}
        onClose={() => emit('close')}
      >
        {slots.default?.()}
      </NTag>
    )
  },
})
