# 权限

分三层，**只有操作级由组件库负责**。

| 层 | 谁负责 | 说明 |
|---|---|---|
| 路由级 | 应用层 | 库不该知道路由结构 |
| 操作级 | `v-permission` | 按钮/链接是否存在 |
| 数据级 | 服务端 | 前端隐藏不构成权限 |

## 提供权限点

```ts
// 应用入口
app.use(createBusinessKit({
  adapter,
  // 传函数而不是数组：权限可能异步加载、随用户切换变化
  permissions: () => currentUser.value?.permissions ?? [],
}))
```

或用 `<FbkProvider>`：

```vue
<FbkProvider :adapter="adapter" :permissions="() => user.permissions">
```

库**不做**「角色 → 权限点」的映射，那是应用的用户体系。

## 操作级：`v-permission`

```vue
<button v-permission="'order:delete'">删除</button>

<!-- 数组语义是「任一满足」 -->
<button v-permission="['order:edit', 'order:delete']">编辑</button>
```

### 无权限时元素被移除，不是隐藏

```ts
// 库的做法：从 DOM 移除
parent.replaceChild(placeholder, el)

// 不是这样：元素还在，脚本一行 el.click() 就能触发
el.style.display = 'none'
```

元素被注释节点占位，权限恢复时会自动插回原位。

### 组合式 API

```ts
import { usePermission } from '@fbk/adapter-core'

const { can, canAny, canAll } = usePermission()
can('order:delete')          // 数组语义为「任一」
canAll(['a', 'b'])           // 全部满足
```

用于表格的 `visible` 这类非模板场景：

```ts
{
  key: 'delete',
  text: '删除',
  visible: () => can('order:delete'),
}
```

## 数据级

见 [数据层契约](/components/data#数据级权限)。

一句话：**前端隐藏不构成权限**，必须由服务端过滤。

## 没有 Provider 时

`v-permission` 与 `usePermission()` 一律判定为无权限，并在 dev 环境 warn。
组件在 Playground 里独立演示时不会崩。
