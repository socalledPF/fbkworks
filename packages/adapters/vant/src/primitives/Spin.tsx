import { defineComponent } from 'vue'
import { Loading } from 'vant'

export const Spin = defineComponent({
  name: 'FbkVantSpin',
  inheritAttrs: false,
  props: {
    loading: { type: Boolean, default: true },
    description: String,
  },
  setup(props, { attrs, slots }) {
    return () => (
      <div {...attrs} class="fbk-vant-spin">
        {props.loading ? <Loading size="24">{props.description ?? '加载中...'}</Loading> : null}
        {slots.default?.()}
      </div>
    )
  },
})
