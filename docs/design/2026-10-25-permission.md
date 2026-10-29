# 设计稿：权限三层

> 企业级前端架构优先级计划的 P1。

## 一、三层权限的边界

| 层 | 谁负责 | 库做什么 |
|---|---|---|
| 路由级 | **应用层** | **不做**。库不该知道路由结构 |
| 操作级 | 库 | `v-permission` 指令 + `usePermission()` |
| 数据级 | 库提供**声明能力**，服务端负责执行 | `scope` 参数 + dev 提醒 |

### 为什么路由级不做

库如果知道「哪些路由需要什么权限」，就必须知道路由表 ——
那是应用架构，不是组件能力。强行做会让库绑死在某一种路由方案上
（我们连 `vue-router` 都是禁止依赖）。

## 二、操作级：`v-permission`

### 2.1 API

```vue
<!-- 无权限时元素不存在 -->
<button v-permission="'order:delete'">删除</button>

<!-- 满足任一即可 -->
<button v-permission="['order:edit', 'order:delete']">编辑</button>
```

### 2.2 关键设计：移除而非隐藏

```ts
// 正确：元素从 DOM 里移除
el.parentNode?.removeChild(el)

// 错误：只是看不见
el.style.display = 'none'   // 元素还在，能被脚本触发
el.setAttribute('disabled', '')  // 仍然可被绕过
```

**为什么这条重要**：`display:none` 的按钮仍然存在于 DOM，
自动化脚本、浏览器插件、甚至控制台一行 `el.click()` 都能触发它。
**移除**才是「这个操作不存在」。

### 2.3 权限来源

权限点从哪来？**由应用注入，库不猜**：

```ts
// 应用入口
app.use(createBusinessKit({
  adapter,
  permissions: () => currentUser.value?.permissions ?? [],
}))
```

传函数而不是数组：权限可能在登录后异步加载、也可能随用户切换变化。
每次检查都调一次函数，天然响应式。

### 2.4 `usePermission()`

```ts
const { can, canAny, canAll } = usePermission()
can('order:delete')                  // boolean
canAny(['a', 'b'])                   // 任一
canAll(['a', 'b'])                   // 全部
```

---

## 三、数据级：声明而非校验

### 3.1 前端无法真正做数据级权限

必须明确：**前端拿到的数据就是全部数据**。若接口返回了 1000 条，
前端隐藏 900 条，那 1000 条依然在 Network 面板里。

所以库能做的只有两件事：

1. **提供显式声明位**（已在 P0 的 `@fbkworks/data` 里实现 `scope`）
2. **在写错时提醒**

### 3.2 已实现的提醒

```ts
createPageRequest({
  fetch,
  rows: 'rows',
  scope: 'client-filtered',  // ← dev 环境 warn
})
```

告警文案已经在 P0 落地，见 `packages/data/src/create.ts`。

### 3.3 P1 新增：`assertServerScope`

给不方便用 `createPageRequest` 的场景（比如自研请求层）一个显式检查：

```ts
import { assertServerScope } from '@fbkworks/data'

// 在获取「含敏感字段」的数据后调用
assertServerScope('order:list')   // 仅 dev 环境 warn，生产无开销
```

它不是校验，是**把认知钉在代码里**。

---

## 四、验收

| 项 | 标准 |
|---|---|
| 指令移除元素 | 无权限时 `querySelector` 查不到（不是 `display:none`） |
| 数组语义 | 传数组时「任一满足」即可见 |
| 响应式 | 权限变化后元素随之出现/消失 |
| 无 Provider 时 | 不抛错，按「无权限」处理并 dev warn |
| 数据级 | `assertServerScope` 仅 dev warn |
| 单测 | 移除、数组、响应式、无 Provider 四个分支 |

## 五、不做

| 不做 | 理由 |
|---|---|
| 角色 → 权限点映射 | 那是应用的用户体系，库不该知道 |
| 路由守卫 | 库不该知道路由 |
| 接口级鉴权 | 服务端职责 |
| 前端加密/脱敏 | 服务端职责，前端做只是心理安慰 |
