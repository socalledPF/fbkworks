import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import DemoBlock from './DemoBlock.vue'
import ApiTable from './ApiTable.vue'

// UI 库本体样式由应用负责（与业务项目一致），这里显式引入三个库以支持切换演示
import 'element-plus/dist/index.css'
import 'vant/lib/index.css'
// 组件样式：文档站渲染的是真实 demo，需要完整的设计系统
// （此前只引了 demos，导致 demo 里的表格 / 图表 / 大屏全是裸样式）
import '@fbk/tokens/css'
import '@fbk/adapter-element-plus/style.css'
import '@fbk/components/styles/index.css'
import '@fbk/chart-core/style.css'
import '@fbk/dashboard/style.css'
import '@fbk/screen/style.css'
// demo 脚手架样式：demo 是文档与 Playground 共用的评审材料，
// 里面的原生 button / p / pre 必须与设计系统一致
import '@fbk/demos/style.css'
import './docs.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('DemoBlock', DemoBlock)
    app.component('ApiTable', ApiTable)
  },
} satisfies Theme
