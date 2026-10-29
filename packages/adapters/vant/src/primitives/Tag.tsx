import { computed, defineComponent, type PropType } from 'vue'
import { Tag as VanTag } from 'vant'
import type { Status } from '@fbkworks/adapter-core'

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'primary',
  default: 'default',
} as const

export const Tag = defineComponent({
  name: 'FbkVantTag',
  inheritAttrs: false,
  props: {
    status: { type: String as PropType<Status>, default: 'default' },
    size: String,
    closable: Boolean,
    bordered: Boolean,
  },
  emits: ['close'],
  setup(props, { attrs, emit, slots }) {
    const type = computed(() => statusType[props.status])
    return () => (
      <VanTag
        {...attrs}
        type={type.value}
        closeable={props.closable}
        plain={props.bordered}
        size={props.size === 'sm' ? 'medium' : 'large'}
        onClose={() => emit('close')}
      >
        {slots.default?.()}
      </VanTag>
    )
  },
})
