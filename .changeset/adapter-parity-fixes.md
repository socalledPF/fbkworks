---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/adapter-vant": minor
---

### 三个适配器的语义对齐（同一个 props 必须得到同一个结果）

一致性套件过去只断言「有没有发出事件」，所以下面三处真实分歧全部漏网。现在都修了，
并且套件补上了**结果断言**（并且验证过：把修复还原，新断言会红）。

**element-plus 的 `DataGrid` 从不读 `selectedKeys`** —— 受控选择是单向的：
父级把 `selectedKeys` 置空（ProTable 的 `clearSelection()` 就是这条路）后勾选框仍然勾着，
而 naive / vant 都跟着外部状态走。现在把 `props.selectedKeys` 真正映射到 ElTable 的选择状态，
并用一个 `syncing` 标记挡住自己触发的那次 `selection-change`，避免「外部置空 → 组件回写非空」的抖动。

**naive-ui 声明 `sort: 'custom'` 却用 `sorter: 'default'`** —— 也就是嘴上说「只发事件」，
手上却在本地把当前页重排一遍。服务端分页时会对当前页二次排序，且与 element-plus 行序不一致。
现在改成 `'custom'`。

**vant 声明 `pagination.mode: 'infinite'`，`Pagination` 原语默认却是 `'pages'`** ——
能力位说无限滚动、直接使用原语却拿到页码分页器。现在 `mode` 进入 `PaginationProps` 契约
（以前它根本不在契约里，业务侧无法类型安全地设置），vant 的默认值对齐自己的能力位
（`'infinite'`），桌面端仍为 `'pages'`。

> 行为变化：vant 的 `Pagination` 在不传 `mode` 时渲染「加载更多」而不是页码器。
> 需要页码器请显式传 `mode: 'pages'`。ProTable 不受影响（它在 infinite 能力下根本不渲染分页器）。
