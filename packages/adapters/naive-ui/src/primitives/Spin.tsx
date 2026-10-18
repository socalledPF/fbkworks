import { defineComponent } from 'vue'
import { NSpin } from 'naive-ui'

export const Spin = defineComponent({
  name: 'FbkNaiveSpin',
  inheritAttrs: false,
  props: {
    loading: { type: Boolean, default: true },
    description: String,
  },
  setup(props, { attrs, slots }) {
    return () => (
      <NSpin {...attrs} show={props.loading} description={props.description}>
        {slots.default?.()}
      </NSpin>
    )
  },
})
