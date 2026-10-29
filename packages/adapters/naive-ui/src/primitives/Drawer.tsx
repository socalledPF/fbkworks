import { defineComponent, type PropType } from 'vue'
import { NDrawer, NDrawerContent } from 'naive-ui'
import type { DrawerProps } from '@fbk/adapter-core'

/**
 * naive 的 NDrawer 只有 direction 与尺寸，没有标题栏：标题与关闭按钮由
 * NDrawerContent 提供（closable），点它内部走 doUpdateShow(false)，
 * 也就是 update:show —— 这里再翻译成契约里的 update:modelValue(false)。
 *
 * bottom 方向用 height 控制尺寸，宽度由 naive 自己铺满 = 移动端全屏。
 */
export const Drawer = defineComponent({
  name: 'FbkNaiveDrawer',
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
        <NDrawer
          {...attrs}
          show={props.modelValue}
          placement={bottom ? 'bottom' : 'right'}
          width={bottom ? undefined : props.width}
          height={bottom ? '100%' : undefined}
          maskClosable={props.closeOnClickModal}
          to="body"
          onUpdate:show={(value: boolean) => emit('update:modelValue', value)}
          onAfterLeave={() => emit('close')}
        >
          <NDrawerContent title={props.title} closable={props.showClose}>
            {{ default: slots.default, footer: slots.footer }}
          </NDrawerContent>
        </NDrawer>
      )
    }
  },
})
