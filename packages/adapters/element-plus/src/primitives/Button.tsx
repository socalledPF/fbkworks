import { computed, defineComponent, type PropType } from 'vue'
import { ElButton } from 'element-plus'
import type { ButtonProps, Size, Status } from '@fbk/adapter-core'
import { toElementSize } from '../size'

const variantType: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | ''> = {
  primary: 'primary',
  default: '',
  dashed: 'primary',
  text: 'primary',
  link: 'primary',
}

const statusType = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  default: '',
} as const

export const Button = defineComponent({
  name: 'FbkElButton',
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<ButtonProps['variant']>, default: 'default' },
    status: { type: String as PropType<Status>, default: undefined },
    size: { type: String as PropType<Size>, default: 'md' },
    disabled: Boolean,
    loading: Boolean,
    block: Boolean,
    nativeType: { type: String as PropType<ButtonProps['nativeType']>, default: 'button' },
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    const type = computed(() => (props.status ? statusType[props.status] : variantType[props.variant ?? 'default']))
    const plain = computed(() => props.variant === 'dashed')
    const text = computed(() => props.variant === 'text')
    const link = computed(() => props.variant === 'link')

    return () => (
      <ElButton
        {...attrs}
        /* 与 naive 适配器对齐的标记类。
           naive 的 text 模式不输出任何类名，样式层只能靠这个标记补控件高度；
           element-plus 本来会输出 .el-button--text，但如果只有一侧有标记类，
           style.css 里针对 .fbk-button--text 的规则就只在一个适配器生效 ——
           两边按钮高度会分叉。所以两个适配器都必须打同一个标记。 */
        class={[text.value || link.value ? 'fbk-button--text' : null, attrs.class]}
        type={type.value}
        size={toElementSize(props.size)}
        disabled={props.disabled}
        loading={props.loading}
        plain={plain.value}
        text={text.value}
        link={link.value}
        nativeType={props.nativeType}
        style={props.block ? { width: '100%', ...((attrs.style as object) ?? {}) } : attrs.style}
        onClick={(event: MouseEvent) => emit('click', event)}
        v-slots={slots}
      />
    )
  },
})
