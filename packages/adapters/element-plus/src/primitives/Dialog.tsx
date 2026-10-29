import { defineComponent, type PropType } from 'vue'
import { ElDialog } from 'element-plus'
import type { DialogProps } from '@fbk/adapter-core'

/**
 * placement 必须真的生效。element-plus 侧落在两处：
 * center → align-center（它自己的居中实现 .el-dialog.is-align-center{margin:auto}）；
 * bottom → fbk-dialog--bottom，由 style.css 把对话框推到视口底部（贴底弹层）。
 *
 * 此前这个适配器完全不读 placement，'center' 与 'bottom' 渲染出的 DOM 一模一样，
 * 而契约里写着它有效 —— 属于声明与实现脱节（审查 B12）。
 */
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
    return () => {
      const bottom = props.placement === 'bottom'
      /* class 要合并而不是覆盖：调用方传进来的 class 得留着，
         贴底标记又是我们自己的语义，两者互不替代。 */
      const { class: attrsClass, ...rest } = attrs as Record<string, any>
      return (
        <ElDialog
          {...rest}
          modelValue={props.modelValue}
          title={props.title}
          width={bottom ? '100%' : props.width}
          alignCenter={!bottom}
          class={[attrsClass, bottom ? 'fbk-dialog--bottom' : undefined]}
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
    }
  },
})
