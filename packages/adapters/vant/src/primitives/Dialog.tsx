import { computed, defineComponent, type PropType } from 'vue'
import { Popup } from 'vant'
import type { DialogProps } from '@fbk/adapter-core'

/** 移动端统一用 Popup 承载弹窗：placement=center 时是居中卡片，bottom 时是底部抽屉。 */
export const Dialog = defineComponent({
  name: 'FbkVantDialog',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    title: String,
    width: { type: [String, Number] as PropType<string | number>, default: '90%' },
    placement: { type: String as PropType<DialogProps['placement']>, default: 'bottom' },
    closeOnClickModal: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { attrs, emit, slots }) {
    const position = computed(() => (props.placement === 'center' ? 'center' : 'bottom'))
    return () => (
      <Popup
        {...attrs}
        show={props.modelValue}
        position={position.value}
        round={position.value === 'bottom'}
        closeable={props.showClose}
        closeOnClickOverlay={props.closeOnClickModal}
        teleport="body"
        style={position.value === 'center' ? { width: typeof props.width === 'number' ? `${props.width}px` : props.width } : undefined}
        onUpdate:show={(value: boolean) => emit('update:modelValue', value)}
        onClosed={() => emit('close')}
      >
        {props.title ? <div class="fbk-vant-dialog__title">{props.title}</div> : null}
        <div class="fbk-vant-dialog__body">{slots.default?.()}</div>
        {slots.footer ? <div class="fbk-vant-dialog__footer">{slots.footer()}</div> : null}
      </Popup>
    )
  },
})
