import { defineComponent } from 'vue'
import { NEmpty } from 'naive-ui'

export const Empty = defineComponent({
  name: 'FbkNaiveEmpty',
  inheritAttrs: false,
  props: { description: { type: String, default: '暂无数据' } },
  setup(props, { attrs, slots }) {
    return () => (
      <NEmpty {...attrs} description={props.description}>
        {slots.default?.()}
      </NEmpty>
    )
  },
})
