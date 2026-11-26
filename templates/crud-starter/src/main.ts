/**
 * 应用入口。**样式顺序不能乱**，写错是静默失效：
 *   1. 令牌：定义 --fbk-* 变量
 *   2. UI 库自身样式：定义 .el-* 的基础外观
 *   3. 适配器样式：把令牌翻译成 .el-* 的变量覆盖
 *   4. 业务组件样式：.fbk-* 类
 *   5. 应用自有样式
 *
 * 第 2 步最容易漏。漏了的话业务组件结构还在，但原生 input/select 裸奔 ——
 * 实测症状是表单变成浏览器默认样式、间距失控，而控制台一句错都不报。
 */
import '@fbkworks/tokens/css'
import '@fbkworks/tokens/dark.css'
import 'element-plus/dist/index.css'
import '@fbkworks/adapter-element-plus/style.css'
import '@fbkworks/components/styles/index.css'
import './app.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
