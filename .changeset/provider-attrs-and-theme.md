---
"@fbkworks/adapter-core": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-vant": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/components": patch
---

Provider 层补齐 attrs 转发、嵌套主题回滚与 system 主题跟随

### 行为修复

- **`<FbkProvider>` 与三个适配器的 RootProvider 丢失 attrs**：与上一轮修的
  9 个组件同源缺陷。真实断点在三个 RootProvider（`inheritAttrs: false` 且不转发）；
  `FbkProvider` 原先靠 Vue 的隐式 fallthrough 侥幸工作——那只在「渲染根恰好是单个组件」
  时成立，根结构一变就静默失效。现在显式转发。

- **嵌套 Provider 卸载后主题不回滚**：`watchEffect` 随 scope 停掉，没有人把父级主题
  重新 apply。实测嵌套 `[light, dark]` 卸载内层后 `data-fbk-theme` 停留在 dark。
  现在用挂载栈：卸载时交给仍在挂载的上一个 Provider，否则回到外层上下文。
  用栈而不是只回滚父级，是因为兄弟 Provider 并存时（微前端 / 多根）卸载其中一个
  不该把另一个正在生效的档位抹掉。

- **`theme: 'system'` 不跟随系统切换**：原实现只在 apply 时读一次
  `matchMedia().matches` 快照。现在把它变成响应式，`change` 监听随卸载移除。

- **`vant` 的 DataGrid 在「空数据 + loading」时什么都不渲染**：`loading` 条要求
  `data.length > 0`，而 Empty 又要求 `!loading`——首次加载时整个列表区空白，
  用户看不到任何反馈。现在 loading 条不再要求 data 非空。

- **`CrudPage.reset()` 每次点击发两个请求**：先重置表单（触发 params 变化 → 第 1 页
  查询），又补一次 `refresh()`，其中一个必被丢弃。现在有查询区时只重置表单，
  由 params 变化驱动；无查询区时才显式刷新。

### ⚠️ 一处 DOM 结构变化

`element-plus` 的 `<FbkProvider>` 现在会多渲染一层 `<div>`：

```
ElConfigProvider 的 render 是 renderSlot(slots, 'default') —— fragment 根，没有元素
可承载 attrs（绑上去只会得到 Vue 的 "Extraneous non-props attributes" 并被丢弃）。
```

`vant` 与 `naive-ui` 的 `ConfigProvider` 自带 `div` 根元素，attrs 直接落在上面，
**不增加层级**。三家的层数因此刻意不对称，这是各库根结构差异决定的，不是遗漏。

影响面：仅显式使用 `<FbkProvider>` 的路径；`app.use(createBusinessKit())` 不渲染
Provider，DOM 完全不变。若你的布局依赖 `height: 100%` 链，请确认这层 div 是否需要
补高度——它没有预设样式。

### 测试

`desktop-parity` 的两条恒真断言已重写并做过变异实验：
- 「DataGrid 顶层结构与 fbk 类名集合一致」两侧都取到 `[]`，`toEqual([])` 恒真 ——
  给某侧多包一层 div 也照样绿。现在比归一化的结构层级，多包一层会红。
- 确认框间距原先对整份 style.css 做 `toContain('--fbk-spacing-sm')`，而该令牌在同文件
  别处也有，故实际规则改成写死像素也照样绿。现在按选择器定位到具体规则块逐条断言。
