import '@fbkworks/tokens/css'
import '@fbkworks/tokens/dark.css'
// 未来科技风预设：与 dark.css 同层，只覆盖语义令牌
import '@fbkworks/tokens/cyber.css'
import 'element-plus/dist/index.css'
import '@fbkworks/adapter-element-plus/style.css'
import '@fbkworks/adapter-element-plus/dark.css'
import 'vant/lib/index.css'
import '@fbkworks/adapter-vant/style.css'
import '@fbkworks/adapter-vant/dark.css'
import '@fbkworks/adapter-naive-ui/style.css'
import '@fbkworks/adapter-naive-ui/dark.css'
/* 组件库只引**聚合入口**：它内部逐条 @import 全部子组件样式（由 gen-style-entries 生成）。
   以前这里还逐个引了 9 个子路径 —— 那是同一个事实的第二份抄写，
   既让同一份 CSS 被引入两次，也和 check-style-entries 的判据（只认聚合入口）互相矛盾。 */
import '@fbkworks/components/styles/index.css'
import '@fbkworks/chart-core/style.css'
import '@fbkworks/dashboard/style.css'
import '@fbkworks/screen/style.css'
// demo 脚手架样式：让 demo 里的原生 button / p / pre 也走设计系统
import '@fbkworks/demos/style.css'
import './playground.css'
