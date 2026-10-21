# 组件样式接入规范

> 这份文档的存在原因：FormModal / CrudPage / Result 三个组件发布时，
> 样式文件写了但**从未被引入**，导致 `gap`、`display:flex` 全部失效，
> 弹窗底部两个按钮紧贴在一起。测试全绿、类型全对，肉眼一看就是坏的。
>
> 根因不是"写错了 CSS"，而是**样式接入链路没有约束**：
> 每个组件的 `style.css` 需要被两处登记才生效，漏一处就静默失效。

---

## 一、样式接入的两条链路

组件的 `style.css` 必须同时登记到**两个入口**，缺一个就有一类使用者拿不到样式：

| 入口 | 服务对象 | 漏掉的后果 |
|---|---|---|
| `packages/components/src/styles/index.css` | 走 `@fbk/components/style.css` 全量引入的业务方 | 全量引入时该组件没有样式 |
| `apps/playground/src/styles.ts` | Playground 与文档站 demo | **开发和评审时看不到真实效果** |

第二条是最危险的：Playground 是唯一的可视化验证环境，漏了它就会出现
"测试全绿、肉眼全坏"——正是本次事故。

---

## 二、新增组件时必须做的事（检查清单）

- [ ] 写 `src/<component>/style.css`
- [ ] 在 `src/styles/index.css` 加 `@import '../<component>/style.css';`
- [ ] 在 `apps/playground/src/styles.ts` 加 `import '@fbk/components/<component>/style.css'`
- [ ] 跑 `pnpm check:styles`（新增的自动校验，见下）
- [ ] 在 Playground 里**实际看一眼**，不只看测试

---

## 三、样式设计规范（写 CSS 前先定这些）

### 3.1 间距

一律用令牌，不写字面量：

实际令牌值（来自 `packages/tokens/src/css/tokens.css`，**以代码为准**）：

| 令牌 | 原语 | 值 |
|---|---|---|
| `--fbk-spacing-xs` | `--fbk-space-4` | 4px |
| `--fbk-spacing-sm` | `--fbk-space-8` | 8px |
| `--fbk-spacing-md` | `--fbk-space-12` | 12px |
| `--fbk-spacing-lg` | `--fbk-space-16` | 16px |
| `--fbk-spacing-xl` | `--fbk-space-24` | 24px |

用途约定：

| 场景 | 令牌 |
|---|---|
| 图标与文字之间 | `--fbk-spacing-xs` (4px) |
| 按钮组内部 | `--fbk-spacing-sm` (8px) |
| 表单项之间 | `--fbk-spacing-md` (12px) |
| 区块之间 | `--fbk-spacing-lg` (16px) |
| 页面级留白 | `--fbk-spacing-xl` (24px) |

### 3.2 按钮组

所有操作区（弹窗底部、表单底部、批量操作）统一：

```css
display: flex;
gap: var(--fbk-spacing-sm);
justify-content: flex-end;
```

移动端（`max-width: 639px`）改为铺满：

```css
justify-content: stretch;
/* 子元素 flex: 1 1 0 */
```

### 3.3 布局容器必须显式声明 `display`

**这是本次事故的直接教训。** `<div>` 默认 `display: block`，此时：

- `gap` 完全不生效（`gap` 只对 flex/grid 有效）
- `justify-content` / `align-items` 也全部无效

写了 `gap` 却没有 `display: flex` 是最隐蔽的样式错误：CSS 合法、不报错、
lint 也过，只是没有任何视觉效果。

### 3.4 字号

组件根节点**必须自己声明 `font-size`**，不能继承：

- naive 的 `NConfigProvider` 会在根节点注入 `font-size: 14px`
- element-plus 不注入，沿用 body 的 16px

不声明就会在两个适配器下长出两套字号，行高与内边距全线错位。

### 3.5 视觉一致性

PC 端 element-plus 与 naive-ui 必须看起来一致。这条由
`packages/internal/adapter-conformance/tests/desktop-parity.spec.ts` 守，
新增组件若两者表现不同，需要在那里加断言。

---

## 四、自动化校验

`pnpm check:styles` 会检查：

1. `src/` 下每个含 `style.css` 的组件目录，都出现在 `styles/index.css` 里
2. 同样出现在 `apps/playground/src/styles.ts` 里
3. 所有 `.fbk-*` 选择器块里，若用了 `gap` / `justify-content` / `align-items`，
   同一规则块内必须有 `display: flex` 或 `display: grid`

第 3 条专门防本次的 bug 复发。

---

## 五、流程要求

> **任何涉及样式的改动，必须先出设计（间距、对齐、断点行为），
> 再写实现。** 不允许"先把 CSS 写上，看起来不对再调"。

具体做法：

1. 在本文档的「设计记录」里写清楚这次要动哪些视觉属性
2. 在 Playground 里手动确认
3. 再提交

### 设计记录

| 日期 | 组件 | 改动 | 验收标准 |
|---|---|---|---|
| 2026-10-21 | FormModal / CrudPage / Result | 补样式接入 + 修 gap 失效 | 弹窗底部按钮间距 8px（实测）；CrudPage 区块间距 16px；Result 垂直居中 |
