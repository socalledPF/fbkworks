import { defineComponent } from 'vue'
import { Empty as VanEmpty } from 'vant'

export const Empty = defineComponent({
  name: 'FbkVantEmpty',
  inheritAttrs: false,
  props: { description: { type: String, default: '暂无数据' } },
  setup(props, { attrs, slots }) {
    return () => (
      <VanEmpty {...attrs} description={props.description}>
        {slots.default?.()}
      </VanEmpty>
    )
  },
})
