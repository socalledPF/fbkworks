import { computed, defineComponent, type PropType } from 'vue'
import { Popup } from 'vant'
import type { DrawerProps } from '@fbk/adapter-core'

const toCssSize = (value: string | number) => (typeof value === 'number' ? `${value}px` : value)

/**
 * 移动端抽屉：van-popup 只有 position，没有标题栏 —— 它自带的 closeable 只是一个
 * 浮在角落的图标，没有 title，也接不住业务方放在标题处的东西。所以标题栏
 * （title + 关闭按钮）由本适配器自绘，否则「抽屉有 title」这条契约在移动端就是空话。
 *
 * placement='bottom' 是移动端的主形态：从底部弹出并铺满整屏（手机没有横向空间）。
 */
export const Drawer = defineComponent({
  name: 'FbkVantDrawer',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    title: String,
    width: { type: [String, Number] as PropType<string | number>, default: '80%' },
    placement: { type: String as PropType<DrawerProps['placement']>, default: 'bottom' },
    closeOnClickModal: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { attrs, emit, slots }) {
    const position = computed(() => (props.placement === 'right' ? 'right' : 'bottom'))
    const style = computed(() =>
      position.value === 'bottom'
        ? { width: '100%', height: '100%' }
        : { width: toCssSize(props.width), height: '100%' },
    )

    return () => (
      <Popup
        {...attrs}
        show={props.modelValue}
        position={position.value}
        closeOnClickOverlay={props.closeOnClickModal}
        teleport="body"
        style={style.value}
        onUpdate:show={(value: boolean) => emit('update:modelValue', value)}
        onClosed={() => emit('close')}
      >
        <div class="fbk-vant-drawer">
          <div class="fbk-vant-drawer__header">
            <div class="fbk-vant-drawer__title">{props.title}</div>
            {props.showClose ? (
              <button
                type="button"
                class="fbk-vant-drawer__close"
                aria-label="关闭"
                onClick={() => emit('update:modelValue', false)}
              >
                ×
              </button>
            ) : null}
          </div>
          <div class="fbk-vant-drawer__body">{slots.default?.()}</div>
          {slots.footer ? <div class="fbk-vant-drawer__footer">{slots.footer()}</div> : null}
        </div>
      </Popup>
    )
  },
})
