import { computed, defineComponent, type PropType } from 'vue'
import { ElTag } from 'element-plus'
import type { Size, Status } from '@fbk/adapter-core'
import { toElementSize } from '../size'

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  default: 'info',
} as const

export const Tag = defineComponent({
  name: 'FbkElTag',
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
    return () => (
      <ElTag
        {...attrs}
        type={type.value}
        size={toElementSize(props.size)}
        closable={props.closable}
        effect={props.bordered ? 'plain' : 'light'}
        onClose={() => emit('close')}
      >
        {slots.default?.()}
      </ElTag>
    )
  },
})
