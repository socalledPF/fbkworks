import { defineComponent, type PropType } from 'vue'
import { ElDialog } from 'element-plus'
import type { DialogProps } from '@fbk/adapter-core'

export const Dialog = defineComponent({
  name: 'FbkElDialog',
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
      <ElDialog
        {...attrs}
        modelValue={props.modelValue}
        title={props.title}
        width={props.width}
        appendToBody
        closeOnClickModal={props.closeOnClickModal}
        showClose={props.showClose}
        onUpdate:modelValue={(value: boolean) => emit('update:modelValue', value)}
        onClose={() => emit('close')}
        v-slots={{
          default: slots.default,
          header: slots.header,
          footer: slots.footer,
        }}
      />
    )
  },
})
