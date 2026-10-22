/**
 * 样式入口。
 *
 * 顺序很重要，写错会静默失效：
 *   1. 令牌（tokens）—— 定义 --fbk-* 变量
 *   2. UI 库自身样式（element-plus/dist/index.css）—— 定义 .el-* 基础外观
 *   3. 适配器样式 —— 把令牌翻译成 .el-* 的变量覆盖
 *   4. 业务组件样式 —— .fbk-* 类
 *   5. 应用自有样式
 *
 * 第 2 步最容易漏。漏了的话业务组件结构还在，但 element-plus 的原生
 * input/select 会裸奔（实测登录页表单变成浏览器默认样式、间距失控）。
 */
import '@fbk/tokens/css'
import '@fbk/tokens/dark.css'
import 'element-plus/dist/index.css'
import '@fbk/adapter-element-plus/style.css'
import '@fbk/adapter-element-plus/dark.css'
import '@fbk/components/styles/index.css'
import '@fbk/chart-core/style.css'
import '@fbk/dashboard/style.css'
import './app.css'
