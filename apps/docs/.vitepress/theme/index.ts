import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import DemoBlock from './DemoBlock.vue'
import ApiTable from './ApiTable.vue'

// UI 库本体样式由应用负责（与业务项目一致），这里显式引入三个库以支持切换演示
import 'element-plus/dist/index.css'
import 'vant/lib/index.css'
import './docs.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('DemoBlock', DemoBlock)
    app.component('ApiTable', ApiTable)
  },
} satisfies Theme
