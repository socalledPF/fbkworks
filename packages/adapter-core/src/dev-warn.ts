import { warnOnce } from '@fbkworks/shared'

/**
 * 仅开发期：把「传了但不生效」变成一条可执行的警告。
 *
 * ## 为什么值得一个模块
 *
 * 本库最贵的一类缺陷是「声明了但从不读取」：用户传了一个 prop，它进不了任何分支，
 * 界面不变、也没有任何提示 —— 用户只会怀疑自己写错了。一次评审里就删掉过 12 个
 * 这样的字段（ROADMAP 判据 3）。所以要在**开发期**把它变成一条警告，而不是等评审。
 *
 * ## 三条纪律
 *
 * 1. **只走 warnOnce**。同一个键在渲染循环里会被调用几百次；直接 console 会刷屏，
 *    而且发布包的 `no-console` 门禁本来也不允许业务代码写 console。
 * 2. **生产构建里必须消失**。所有入口都被 `import.meta.env.DEV` 守卫包住：Vite 生产
 *    构建把守卫替换成 `false` 后，整块代码连同对这里的 import 一起被 tree-shake
 *    （实测：`packages/components/dist` 里搜不到 devWarnUnknownProps）。
 *    取值走 `?.`：非 Vite 消费者（webpack / Node SSR）里 `import.meta.env` 是
 *    undefined，写成 `import.meta.env.DEV` 会在 setup 期抛 TypeError ——
 *    那等于用一条 dev 提示换掉一个生产崩溃。
 * 3. **文案必须可执行**。说清「该传什么」，而不是只说「这个字段无效」。
 *
 * ## 两张登记表是唯一真相
 *
 * 已移除 / 当前无效的字段及其替代写法都写在下面，`pnpm check:dev-warn` 读的也是它们：
 * 想在 types.ts 里加一个没人读取的字段，必须在这里交代它为什么无效，否则门禁变红。
 */

/** 包内没有 vite/client 类型（`types: ["node"]`），而引入它会把契约包绑到构建工具上
 *  （同 packages/data/src/scope.ts 的结论）。所以按运行时形状就地断言，不污染消费者。 */
type DevEnv = { env?: { DEV?: boolean } }

/** 仅开发期。上面第 2 条纪律：调用点同样用 `import.meta.env.DEV` 守卫，这里再兜一次。 */
function isDev(): boolean {
  return (import.meta as unknown as DevEnv).env?.DEV === true
}

/**
 * 已移除的字段 → 现在该写什么。
 *
 * 键是「契约名.字段名」：契约名就是调用点传的 componentName（`ProTableColumn` / `FormModal` …）。
 * 这些字段已经不在类型里了，用户传了它只会落进 attrs —— 正是本模块要抓的静默失效。
 */
export const REMOVED_PROPS: Readonly<Record<string, string>> = {
  'ProTableColumn.hideInCard':
    '卡片模式隐藏该列请改用 mobile.hidden，例如 { key: "name", title: "名称", mobile: { hidden: true } }',
  'FormModal.autoFocus':
    '需要打开即聚焦时，在 show 变为 true 之后自己调用表单实例（formRef）或对目标元素调 focus()',
  'FormField.dependencies':
    'disabled / hidden 本来就在每次值变化时重算，删掉这个字段即可，不需要声明依赖',
}

/**
 * 声明了、但当前不生效的字段 → 现在该写什么。
 *
 * 与上面的区别：这些字段**还在类型里**（删掉对已写它们的业务方是硬破版），
 * 但实现里一次都没读过，传了没有效果。check:dev-warn 要求「无读取的字段」必须在这里登记。
 */
export const UNIMPLEMENTED_PROPS: Readonly<Record<string, string>> = {
  'ProTableColumn.search':
    '列不会被渲染进查询区，写 true 也没有效果；查询条件请写进 QueryForm 的 fields（或由 @fbkworks/schema 的派生器生成）',
}

/** Vue 自己会塞进 attrs 的键：class / style / 事件监听 / data-* / aria-* 不是「传错的 prop」。 */
const FRAMEWORK_ATTR = /^(?:key|ref|slot|is|class|style|id|on[A-Z].*|data-.*|aria-.*)$/

function warnRemoved(componentName: string, key: string, hint: string): void {
  warnOnce(
    `dev-removed:${componentName}.${key}`,
    `${componentName} 不再接受「${key}」：该字段已移除，传了不会生效。\n  ${hint}`,
  )
}

/**
 * 仅开发期：对比契约字段与实际收到的 props，对未声明的键给出可执行警告。
 *
 * @param componentName 契约名，同时用于登记表查找与文案（`ProTable` / `FormModal` …）
 * @param received 实际收到的键。组件里传 `useAttrs()` —— 已声明的 prop 不会出现在这里，
 *   所以「未声明的键」等于「用户传了但组件不认识的键」
 * @param allowed 契约里**已实现**的字段。它能被检查出来，也是这条警告可执行的原因：
 *   文案会把可用字段列给用户，而不是只说一句「无效」
 */
export function devWarnUnknownProps(
  componentName: string,
  received: Record<string, unknown>,
  allowed: readonly string[],
): void {
  if (!isDev()) return

  const allowedSet = new Set(allowed)
  for (const key of Object.keys(received)) {
    if (allowedSet.has(key) || FRAMEWORK_ATTR.test(key)) continue
    const removedHint = REMOVED_PROPS[`${componentName}.${key}`]
    if (removedHint) {
      warnRemoved(componentName, key, removedHint)
      continue
    }
    warnOnce(
      `dev-unknown:${componentName}.${key}`,
      `${componentName} 收到未声明的 prop「${key}」：它不在契约里，传了不会生效。\n  可用字段：${allowed.join('、')}`,
    )
  }
}

/**
 * 仅开发期：对象数组型 prop 的元素里出现了已移除字段时，按登记表反向提醒。
 *
 * 为什么不能复用 `devWarnUnknownProps`：`ProTableColumn` 继承 `DataGridColumn`、
 * `FormField` 继承 `QueryField` —— 想用「未在 allowed 里」判定非法，就得把那 24 个
 * 继承字段名在每个调用点抄一遍；抄漏一个，用户传合法字段反而会被报警。
 * 所以这类契约只做反向检查：命中登记表才说话。
 */
export function devWarnRemovedProps(componentName: string, received: object): void {
  if (!isDev()) return

  for (const key of Object.keys(received)) {
    const removedHint = REMOVED_PROPS[`${componentName}.${key}`]
    if (removedHint) warnRemoved(componentName, key, removedHint)
  }
}

/**
 * 仅开发期：对「声明了但当前无效」的字段给出一次性说明。
 *
 * @param hint 替代写法。调用点传 `UNIMPLEMENTED_PROPS` 里的同一条，避免两处文案分叉
 */
export function devWarnUnimplemented(componentName: string, prop: string, hint: string): void {
  if (!isDev()) return

  warnOnce(
    `dev-unimplemented:${componentName}.${prop}`,
    `${componentName}.${prop} 当前无效：${hint}`,
  )
}
