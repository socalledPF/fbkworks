import { defineComponent } from 'vue'
import { ElEmpty } from 'element-plus'

export const Empty = defineComponent({
  name: 'FbkElEmpty',
  inheritAttrs: false,
  props: { description: { type: String, default: '暂无数据' } },
  setup(props, { attrs, slots }) {
    return () => (
      <ElEmpty {...attrs} description={props.description}>
        {slots.default?.()}
      </ElEmpty>
    )
  },
})
