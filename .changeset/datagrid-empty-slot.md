---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/adapter-vant": minor
"@fbkworks/components": minor
---

### 新增 `DataGrid` / `ProTable` 的 `empty` 插槽

自定义空态。不传时行为完全不变（适配器自己的空态组件 + `emptyText` 文案）。

为什么不给空态再造一个组件：`FbkEmpty` 曾存在并被删掉 —— 它只是把同一件事又包了一层。
一个插槽就够了，三个适配器共用同一语义：**传了就用业务内容，没传才渲染默认空态**。

### `useAdapter()` 增加 apiVersion 运行时护栏

`components` 与 `adapter-core` 目前同组发布，但拆 `fixed` 之后两者可以各自升级。
那时「组件 0.5 配 core 0.4」或「core 0.5 配一个按 0.4 契约写的适配器」在构建期都不会报错，
只会在运行时少一个原语、多一个被忽略的字段。

现在每个组件取适配器都要经过 `useAdapter()`，版本对不上会立刻抛出带双方版本号的错误。
放在入口而不是每个组件里，就不存在「漏了一个组件」。
