---
"@fbkworks/components": minor
"@fbkworks/adapter-element-plus": patch
"@fbkworks/adapter-naive-ui": patch
---

### 删掉四个从不读取的公开字段；分页的 mode 不再漏成 DOM 属性

这四个字段都是「声明了、文档写了、实现从不读取」——留着只会让人写了一个不生效的配置，
还以为是自己用法不对：

- `ProTableAction.icon`：按钮只渲染 `text`
- `ProTableColumn.hideInCard`：卡片模式实际看 `DataGridColumn.mobile.hidden`（两套「隐藏」并存）
- `FormField.dependencies`：全表本来就会重算，字段本身是噪音
- `FormModal.autoFocus`：聚焦逻辑从未实现

`PaginationProps.mode` 保留在契约里（vant 的无限滚动形态需要它），但 element-plus / naive-ui
现在也声明它 —— 之前没有声明，于是经 `{...attrs}` 落成 `<div mode="pages">` 这种非法属性。