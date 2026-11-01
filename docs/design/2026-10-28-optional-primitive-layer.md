# 设计稿：可选原语层 —— Drawer 移出必填清单（C）

> 决定已定：**`Drawer` 放入特性层。**
> 这是四项架构改造里唯一改动公开契约的一项，因此单独立稿。

---

## 一、要解决的问题

`UiPrimitives` 的每个键都是必填，`assertAdapterCompatible` 在启动时硬校验。
后果：

| # | 问题 | 证据 |
|---|---|---|
| 1 | **新增原语 = 破版** | v2 加 DatePicker/Radio、v3 加 Drawer，两次都是新增，两次都必须升版本号，升完所有旧适配器启动即抛错 |
| 2 | **类型无法表达「有 N-1 个」** | `UiPrimitives` 全是必填属性，缺一个类型就不成立 |
| 3 | **一个能力位变成恒真死位** | `overlay.supportsDrawer` 永远为 true（Drawer 必填），不携带信息 |

核心洞察：**版本号现在同时管「改坏已有」和「新增有无」**。前者该管，后者不该。

---

## 二、为什么是 Drawer

判据（三条同时满足才进特性层）：

| 判据 | Drawer | 其余原语 |
|---|---|---|
| F1 同一用户需求有官方完整替代 | ✅ `FbkDetailPage`（已文档化） | ❌ 缺了只能是降级 |
| F2 存在现实适配器不会实现它 | ✅ 只提供 popup/modal 的极简 UI 库 | ❌ 任何 UI 库都有 |
| F3 缺失可用点报错而非降级 | ✅ 见第四节 | — |

实测：`Drawer` 只有 1 个消费者（`DetailDrawer.vue`）。
（注：消费者数量不是判据——`DataGrid`/`Dialog`/`Tag` 也都是 1 个，但它们缺了没有替代路径。）

---

## 三、类型设计

```ts
export interface UiPrimitives {
  // ... 13 个必填
  /**
   * 可选原语：缺了只影响 FbkDetailDrawer，库的其余部分完全正常。
   * 缺失时 FbkDetailDrawer 在 mount 阶段抛错并指向 FbkDetailPage。
   */
  Drawer?: Component
}
```

`required` 清单移除 `'Drawer'`。

---

## 四、运行时设计：用点报错，不降级

新增 `requirePrimitive()`：

```ts
// packages/adapter-core/src/contracts/adapter.ts
export function requirePrimitive<K extends keyof UiPrimitives>(
  adapter: UiAdapter,
  key: K,
  alternative: string,
): NonNullable<UiPrimitives[K]> {
  const primitive = adapter.primitives[key]
  if (!primitive) {
    throw new Error(
      `[fbk] 适配器「${adapter.meta.name}」没有提供 ${String(key)} 原语，` +
        `该组件不可用。${alternative}`,
    )
  }
  return primitive as NonNullable<UiPrimitives[K]>
}
```

`FbkDetailDrawer`：

```ts
const Drawer = requirePrimitive(adapter, 'Drawer', '可改用 FbkDetailPage 以整页形式展示同样的内容。')
```

**这不是降级。** 降级是「看起来能用、行为不同」；报错是「明确告诉你这里用不了、并给出替代方案」。
项目原则是显式失败优于静默降级——现在的做法（启动时整个适配器不能用）恰恰是最不显式的。

---

## 五、能力位：保留，但钉死一致性

`overlay.supportsDrawer` **保留**（业务侧据此决定用抽屉还是整页，是合法用法），但必须与
`primitives.Drawer` 的存在性**恒等**——否则又变成两个真相源。

由两处守着：

1. **一致性套件**新增断言：`capabilities.overlay.supportsDrawer === Boolean(primitives.Drawer)`
2. **B1 的覆盖表**已有 `'overlay.supportsDrawer': { static: (a) => Boolean(a.primitives?.Drawer) }`

---

## 六、一致性套件的 Drawer 块改为条件执行

现在 `describe('Drawer')` 是无条件跑的。没有 Drawer 现在是**合法的**，所以整块应改为条件跳过。

**但必须skip 而不是藏掉** —— 套件自己的注释已经立了这条规矩：

> 跳过必须在测试输出里以 skipped 出现。否则契约项等于无声消失 ——
> 本套件最初就在 skip 类型里声明了 'sort' 而一条 sort 用例都没有。

---

## 七、版本号：**不升**

`ADAPTER_API_VERSION` 保持 3。

理由：把必填改为可选是**更宽松**的约束。

- 已有的 v3 适配器（带 Drawer）→ 仍然通过
- 之前不被允许的适配器（无 Drawer）→ 现在可以通过

没有任何适配器因为这次改动而失败，所以不该破版。与 `Empty` 移除同理：

> **新增原语会破版（旧适配器缺成员），减少约束不会。**

---

## 八、迁移路径（第三方适配器）

**无需改动。** 现有适配器继续工作。

可选：如果不需要抽屉，可以从 `primitives` 里去掉 `Drawer`，并把 `overlay.supportsDrawer` 设为 `false`。

业务侧：`<FbkDetailDrawer>` 在缺 Drawer 的适配器上会抛出带替代指引的错误。

---

## 九、测试

1. **一致性套件**：`supportsDrawer` 与 `primitives.Drawer` 恒等
2. **一致性套件**：无 Drawer 时整个 Drawer 块 `skipped` 而非失败
3. **组件测试**：mock 适配器去掉 Drawer 后，`FbkDetailDrawer` mount 抛错，且错误信息含 `FbkDetailPage`
4. **证伪**：直接删掉 `requiredPrimitive` 的守卫 → 用例 3 必须红
5. `pnpm verify` 全绿

---

## 十、不做什么

| 不做 | 理由 |
|---|---|
| 拆更多原语到特性层 | 其余 13 个都不满足 F1（缺了只能降级） |
| 给 `DataGrid` 加 `empty` 插槽 | 独立的产品缺口，与本次契约改造无关 |
| 引入「适配器能力协商」之类的通用机制 | 一个成员的特性层够用了，YAGNI |
| 让 `FbkDetailDrawer` 降级成 Dialog | 那是降级，正是要避免的 |
