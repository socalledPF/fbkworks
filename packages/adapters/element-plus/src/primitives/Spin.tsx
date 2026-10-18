import { defineComponent, h } from 'vue'

/**
 * element-plus 没有独立的 Spin 组件（只有 v-loading 指令）。
 * 这里用 tokens 驱动的纯 CSS 指示器，避免为了一个加载态引入指令注册要求。
 */
export const Spin = defineComponent({
  name: 'FbkElSpin',
  inheritAttrs: false,
  props: {
    loading: { type: Boolean, default: true },
    description: String,
  },
  setup(props, { attrs, slots }) {
    return () =>
      h('div', { ...attrs, class: 'fbk-spin' }, [
        props.loading
          ? h('div', { class: 'fbk-spin__indicator', 'data-fbk-part': 'spin' }, [
              h('span', { class: 'fbk-spin__dot' }),
              props.description ? h('span', { class: 'fbk-spin__description' }, props.description) : null,
            ])
          : null,
        slots.default?.(),
      ])
  },
})
