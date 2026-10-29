import { defineComponent, type PropType } from 'vue'
import { ElDrawer } from 'element-plus'
import type { DrawerProps } from '@fbk/adapter-core'

/**
 * 桌面抽屉：ElDrawer 用的是方向（direction）而不是位置语义。
 * right → rtl（右侧滑入，宽度取 size），bottom → btt（底部滑入，高度取 size）。
 * btt 方向本身铺满宽度，所以底部弹出时不再传固定宽度 —— 那正是移动端全屏。
 *
 * 关闭走 beforeClose 而不是等 ElDrawer 自己 emit update:modelValue：
 * element-plus 是在**离场动画结束**（afterLeave）才发那个事件的，
 * 动画被中断就永远不发；而在没有 transitionend 的环境里（jsdom / 关掉动画）
 * 一次都不会发。把关闭意图同步翻译成 update:modelValue(false)，
 * 再让父级通过 modelValue 收回抽屉 —— 与 vant / naive 的行为一致（纯受控）。
 */
export const Drawer = defineComponent({
  name: 'FbkElDrawer',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    title: String,
    width: { type: [String, Number] as PropType<string | number>, default: '480px' },
    placement: { type: String as PropType<DrawerProps['placement']>, default: 'right' },
    closeOnClickModal: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { attrs, emit, slots }) {
    return () => {
      const bottom = props.placement === 'bottom'
      return (
        <ElDrawer
          {...attrs}
          modelValue={props.modelValue}
          title={props.title}
          direction={bottom ? 'btt' : 'rtl'}
          size={bottom ? '100%' : props.width}
          appendToBody
          closeOnClickModal={props.closeOnClickModal}
          showClose={props.showClose}
          /* 关闭控件 / 点遮罩 / ESC 都汇到这里，同步发出关闭意图 */
          beforeClose={() => emit('update:modelValue', false)}
          onUpdate:modelValue={(value: boolean) => {
            /* ElDrawer 在离场后才补发的 false 已经晚了：父级早就收过上面的意图，
               再发一次就是重复事件；只有 true 是我们没发过的新状态 */
            if (value) emit('update:modelValue', value)
          }}
          onClose={() => emit('close')}
          v-slots={{ default: slots.default, footer: slots.footer }}
        />
      )
    }
  },
})
