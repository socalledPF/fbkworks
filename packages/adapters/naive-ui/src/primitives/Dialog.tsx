import { defineComponent, type PropType } from 'vue'
import { NModal, NCard } from 'naive-ui'
import type { DialogProps } from '@fbk/adapter-core'

export const Dialog = defineComponent({
  name: 'FbkNaiveDialog',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    title: String,
    width: { type: [String, Number] as PropType<string | number>, default: '520px' },
    placement: { type: String as PropType<DialogProps['placement']>, default: 'center' },
    closeOnClickModal: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { attrs, emit, slots }) {
    return () => (
      <NModal
        {...attrs}
        show={props.modelValue}
        maskClosable={props.closeOnClickModal}
        onUpdate:show={(value: boolean) => emit('update:modelValue', value)}
        onAfterLeave={() => emit('close')}
        v-slots={{
          default: () => (
            <NCard
              style={{ width: typeof props.width === 'number' ? `${props.width}px` : props.width }}
              title={props.title}
              closable={props.showClose}
              onClose={() => emit('update:modelValue', false)}
            >
              {{
                default: slots.default,
                footer: slots.footer,
              }}
            </NCard>
          ),
        }}
      />
    )
  },
})
