# FBK Admin — 后台管理系统 demo

用 `@fbkworks/*` 组件库搭一个**真实的后台管理系统**，作为「吃自己的狗粮」测试。

## 为什么需要它

单测和 Playground 都是「一个组件一个页面」，覆盖不到**组合场景**。
这个 demo 把组件放进真实后台的约束里：全局布局、多页面路由、
服务端分页排序、主题切换、权限异常页 —— 用来暴露单测永远发现不了的问题。

实际已经暴露并修复的 4 个问题：

| 问题 | 单测能发现吗 |
|---|---|
| `FbkProvider` 的 `theme` prop 变化不生效（只在 setup 读一次） | 否 |
| ProTable 批量条在工具栏之前，主操作被压在下面 | 否 |
| `CrudPage` 没有 `title` prop，传了被静默丢弃 | 否 |
| 样式入口漏了 `element-plus/dist/index.css`，表单裸奔 | 否 |

## 技术选择

| 项 | 选择 | 理由 |
|---|---|---|
| UI 适配器 | **只接 element-plus** | 模拟真实项目；Playground 才是多适配器对比台 |
| 路由 | **手写 40 行 hash 路由** | `vue-router` 是第一类禁止依赖，见 style-guide 第六节 |
| 数据 | 内存 mock，带延迟与 AbortSignal | 模拟真实后端的竞态与取消 |
| 状态管理 | 无 | 这个规模不需要 |

## 页面

| 路径 | 页面 | 检验的组件 |
|---|---|---|
| `#/` | 工作台 | StatCard / TrendChart / PieChart / RankList / ProTable |
| `#/orders` | 订单列表 | CrudPage + QueryForm + ProTable + FormModal |
| `#/orders/:id` | 订单详情 | PageContainer + Descriptions + Result |
| `#/users` | 用户管理 | CrudPage（无弹窗，行内操作） |
| `#/settings` | 系统设置 | FormGenerator（独立页面 + 字段依赖禁用） |
| `#/403` `#/404` | 异常页 | Result |

## 运行

```bash
pnpm admin          # http://localhost:5185
```

演示账号 `admin` / `admin123`（任意账号可登录）。

## 验证

```bash
# 需先 pnpm admin 启动
python scripts/visual/verify-admin.py 5185
```

覆盖 **16 组 / 35 项**：登录、4 个页面渲染、全选与批量条、弹窗、筛选、排序、
详情跳转、`DetailPage` 字段与 404、异常页、暗色主题（令牌层 + UI 库层双向检查）、
可观测性上报、权限移除（删 DOM 而非 `display:none`）、console 无错误。

CI 的 `visual` job 会自动跑它（起 admin 后执行同一个脚本）。
