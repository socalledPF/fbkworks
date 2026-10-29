import { defineComponent, type CSSProperties, type PropType } from 'vue'
import { NModal, NCard } from 'naive-ui'
import type { DialogProps } from '@fbk/adapter-core'

const toCssSize = (value: string | number) => (typeof value === 'number' ? `${value}px` : value)

/**
 * placement 必须真的生效（此前这个适配器完全不读它，属于审查 B12）。
 *
 * naive 的 NModal 把内容放进 .n-modal-scroll-content，那是个 flex 容器，
 * 卡片位置由 align-self 决定：center 保持库默认的居中，bottom 用 flex-end
 * 把卡片压到视口底部并铺满宽度 —— 也就是贴底弹层。
 */
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
    return () => {
      const bottom = props.placement === 'bottom'
      const cardStyle: CSSProperties = bottom
        ? { width: '100%', alignSelf: 'flex-end' }
        : { width: toCssSize(props.width) }
      return (
        <NModal
          {...attrs}
          show={props.modelValue}
          maskClosable={props.closeOnClickModal}
          onUpdate:show={(value: boolean) => emit('update:modelValue', value)}
          onAfterLeave={() => emit('close')}
          v-slots={{
            default: () => (
              <NCard
                class={bottom ? 'fbk-naive-dialog--bottom' : undefined}
                style={cardStyle}
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
    }
  },
})
