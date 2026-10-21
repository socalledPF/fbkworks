# 设计记录：确认框按钮间距 + Playground 控件统一

## 背景

两个视觉缺陷，都是「实测发现的」而不是推测：

### 缺陷 1：feedback 确认框按钮间距为 0

实测三个适配器的确认框按钮间隙：

| 适配器 | 按钮间隙 | 父容器 display | 原因 |
|---|---|---|---|
| element-plus | **0px** | flex | 库自身 `.el-message-box__btns` 没有 gap |
| naive-ui | 12px | flex | naive 自带 margin |
| vant | **0px** | flex | `.van-dialog__footer` 无 gap |

三个适配器**不一致**，这是 PC 端不能接受的（element 与 naive 都用于桌面端）。

### 缺陷 2：Playground 顶部是浏览器原生控件

实测 `.playground__field select`：

```
fontFamily: Arial        ← 不是设计系统的字体
fontSize:   13.3333px    ← 浏览器默认
borderRadius: 2px        ← 浏览器默认
background: rgb(245,246,247)  ← 浏览器默认
```

Playground 是**评审环境**。评审环境本身不像产品，就没法判断"组件到底好不好看"。
更严重的是：它和真实业务页面的控件外观完全不同，容易让人误判组件效果。

---

## 设计目标

### 目标 1：确认框按钮间距统一为 8px

- 与 `FormModal` 底部按钮组保持同一数值（`--fbk-spacing-sm` = 8px）
- 三个适配器一致
- 只影响确认框的按钮区，不动库的其他内部样式

**不采用的方案**：

| 方案 | 为什么不 |
|---|---|
| 改 `--fbk-spacing-sm` | 影响全站，为一个小场景改全局令牌是本末倒置 |
| 用 `!important` 硬压 | 消费方无法再覆盖，违反"样式可定制"的约定 |
| 只改 element-plus | 三个适配器不一致，PC 双适配器一致性会被破坏 |

**采用**：在各适配器的 `style.css` 里针对确认框按钮容器加 `gap`，
特异性控制在 0,1,0（单个类），消费方仍可用更高特异性覆盖。

### 目标 2：Playground 控件改用 fbk 令牌

**不采用**「直接用业务组件 Button」的方案：

- Playground 的顶部是**工具条**，不是业务界面
- 引入 `@fbk/components` 的 Button 会让 Playground 依赖自己的被测对象，
  出现"用组件测组件"的循环，反而看不清组件在真实业务里的样子

**采用**：用 `--fbk-*` 令牌重写 `playground.css` 里的控件样式。

设计规格：

| 属性 | 值 | 来源 |
|---|---|---|
| 高度 | 32px | 与业务组件控件一致 |
| 圆角 | `--fbk-radius-md` | 令牌 |
| 边框 | `1px solid var(--fbk-color-border)` | 令牌 |
| 背景 | `var(--fbk-color-bg-container)` | 令牌 |
| 文字色 | `var(--fbk-color-text)` | 令牌 |
| 字号 | `var(--fbk-font-size-md)` | 令牌 |
| 字体 | `var(--fbk-font-family)` | 令牌 |
| 焦点环 | `var(--fbk-shadow-focus-ring)` | 令牌，与业务组件一致 |
| 控件间距 | `var(--fbk-spacing-sm)` | 令牌 |

断点：`max-width: 900px` 时工具条换行（现在已经是这样）。

---

## 验收标准

1. 三个适配器的确认框按钮间隙都是 **8px**（容差 0.5px）
2. Playground 的 select / button：
   - `font-family` 是 fbk 字体栈（不含 Arial）
   - `font-size` 等于 `--fbk-font-size-md` 的计算值
   - `border-radius` 等于 `--fbk-radius-md` 的计算值
   - `height` 为 32px
3. `pnpm check:styles` 仍通过
4. `pnpm verify` 全绿

## 自动化校验

- 确认框间距：加到 `desktop-parity.spec.ts` 或新增一条针对 adapter style.css 的断言
  （jsdom 无布局引擎，量不出间距，因此断言 CSS 里存在对应规则）
- Playground 控件：断言 `playground.css` 里 select/button 规则使用了令牌而非字面量
