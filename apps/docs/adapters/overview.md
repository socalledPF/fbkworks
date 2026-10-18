# 能力矩阵

不追求三库像素一致。适配器声明能力，业务组件按能力降级——**信息层级与交互语义一致，表现形态允许不同**。

## DataGrid

| 能力 | element-plus | vant4 | naive-ui |
|---|---|---|---|
| 表现形态 | `table` | `cards` | `table` |
| 多选 | ✅ | ✅（卡片 checkbox） | ✅ |
| 排序 | ✅ custom | ✅ custom | ✅ custom |
| 展开行 | ✅ | ❌ | ✅ |
| 树形数据 | ✅ | ❌ | ✅ |
| 虚拟滚动 | ❌ | ❌ | ✅ |
| 固定表头 | ✅ | ❌ | ✅ |

## 分页

| | element-plus | vant4 | naive-ui |
|---|---|---|---|
| 模式 | `pages` | `infinite` | `pages` |
| 每页条数 | ✅ | ❌ | ✅ |
| 跳页 | ✅ | ❌ | ✅ |

ProTable 读取 `capabilities.pagination.mode`：

- `pages` → 渲染 Pagination 原语；
- `infinite` → 把 `loadMore` / `finished` 交给 DataGrid，由 `van-list` 触底加载。

## 表单

| | element-plus | vant4 | naive-ui |
|---|---|---|---|
| 布局 | horizontal | vertical | horizontal |
| labelWidth | ✅ | ❌ | ✅ |
| `validate()` Promise | ✅ | ✅（事件桥接） | ✅ |
| 异步校验 | ✅ | ✅ | ✅ |

## 浮层与主题

| | element-plus | vant4 | naive-ui |
|---|---|---|---|
| 浮层形态 | dialog / drawer | popup | dialog / drawer |
| 主题机制 | CSS 变量 | CSS 变量 | Provider |
| 暗色 | `html.dark` | `van-config-provider` | `NConfigProvider` |

::: warning provider 型主题
naive-ui 的 `theme.cssVariables === false`。只 `apply()` 不包 `<FbkProvider>` 时暗色不会生效。
:::

## 读取能力

```ts
import { useAdapter } from '@fbk/adapter-core'

const adapter = useAdapter()
if (adapter.capabilities.dataGrid.selection) {
  // 渲染批量操作栏
}
```

业务代码里**不应该**出现 `adapter.meta.name === 'vant'` 这样的判断——那是把适配器差异又写回了业务层。
