# Result 异常状态页

`403 / 404 / 500 / 无权限 / 空数据` 这类页面每个项目都要写一遍。这里固化成一套语义 + 插槽。

**不需要适配器**：纯展示组件，只用 tokens 与 CSS。这也印证了「不是所有组件都要经过适配层」——
只有三库行为确实不同的部分才需要。

## 基础用法

```vue
<FbkResult status="404" />
<FbkResult status="403" />
<FbkResult status="500" extra="Trace ID: 7f3a9c2e" />
```

数字状态渲染成大号状态码，语义状态渲染 SVG 图标。

## 状态与默认文案

| status | 默认标题 | 默认说明 |
|---|---|---|
| `success` | 操作成功 | — |
| `warning` | 请注意 | — |
| `error` | 出错了 | 请稍后重试，或联系管理员 |
| `info` | 提示 | — |
| `403` | 无访问权限 | 你当前的角色没有查看该页面的权限 |
| `404` | 页面不存在 | 链接可能已失效，或页面已被移除 |
| `500` | 服务器错误 | 服务暂时不可用，请稍后重试 |

`title` / `subtitle` 可覆盖任意一项。

## 插槽

| 名称 | 说明 |
|---|---|
| `icon` | 覆盖默认图标 |
| `default` | 标题下方的内容区 |
| `actions` | 操作区（按钮组） |

```vue
<FbkResult status="404">
  <template #actions>
    <FbkButton variant="primary" @click="$router.push('/')">返回首页</FbkButton>
    <FbkButton @click="reload">重试</FbkButton>
  </template>
</FbkResult>
```

## 为什么图标用内联 SVG 而不是 emoji

同一个 ✅ 在 Windows 与 macOS 上的颜色、比例都不同。状态页恰恰是最需要
「看起来一致」的场合，所以图标是内联 SVG，跟着 tokens 的语义色走。

## API

| 属性 | 说明 |
|---|---|
| `status` | 状态，见上表 |
| `title` | 主标题，默认按 status 取 |
| `subtitle` | 补充说明 |
| `extra` | 额外内容（错误详情、Trace ID 等），渲染为等宽字体块 |
