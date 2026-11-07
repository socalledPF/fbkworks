/**
 * 能力位 → 验证责任 的映射表。
 *
 * 存在理由：`Capabilities` 是手写的字面量，与实现之间没有任何类型层面的关联。
 * 类型检查只能保证「这个对象符合形状」，保证不了「声明的东西真的被实现」。
 * 结果就是本轮审查发现的那一类缺陷：`feedback.notification = true` 但契约里没有
 * 这个成员；`dataGrid.tree = true` 但 DataGrid.tsx 里一次都没出现过 `tree`。
 *
 * 这张表要求：**每一个"真值"能力位都必须交代由谁验证**。三种交代方式：
 *
 *   · `{ marker: '...' }`    一致性套件里有对应用例（源码里打 `@capability` 标记）
 *   · `{ static: ... }`      适配器对象上成员存在即可判定
 *   · `{ browserOnly: ... }`  jsdom 里测不出来，但**真实浏览器里有验证**，
 *                            必须指明脚本路径；脚本必须存在且含对应 `@capability` 标记
 *
 * `browserOnly` 与 `unverified` 的区别就是「环境测不了」和「没人负责」的区别：
 * 前者有可执行的验证，只是跑在浏览器里；后者什么都没有。strict 只放行前者。
 *   · `{ unverified: '...' }` 暂时没有验证，写明原因 —— 这是显性的欠债，不是放过
 *
 * 「真值」的定义（见 capability-coverage.spec.ts）：
 *   · boolean 为 true
 *   · 枚举值不是基线（sort 的基线是 'none'，pagination.mode 的基线是 'pages'）
 *   · 纯描述性枚举不参与：presentation / layout / kind —— 它们描述"选了什么"，
 *     不是"有没有能力"，不存在"声明了却没实现"这种状态。
 */

export type CapabilityCoverage =
  | { marker: string }
  | { static: (adapter: any) => unknown }
  | { browserOnly: { reason: string; script: string } }
  | { unverified: string }

/** 纯描述性枚举：描述选择而非能力开关，不要求覆盖 */
export const DESCRIPTIVE_KEYS = [
  'dataGrid.presentation',
  'form.layout',
  'overlay.kind',
] as const

/** 枚举类能力的基线值：等于基线表示"没有这个能力"，不需要覆盖 */
export const ENUM_BASELINES: Record<string, string> = {
  'dataGrid.sort': 'none',
  'pagination.mode': 'pages',
}

export const CAPABILITY_COVERAGE: Record<string, CapabilityCoverage> = {
  // ── 一致性套件覆盖 ────────────────────────────────────────────
  'dataGrid.selection': { marker: 'dataGrid.selection' },
  'dataGrid.sort': { marker: 'dataGrid.sort' },
  'theme.darkMode': { marker: 'theme.darkMode' },
  'theme.provider': { marker: 'theme.provider' },

  // ── 静态可判定：适配器对象上有没有这个成员 ──────────────────────
  'feedback.message': { static: (a) => typeof a.feedback?.message === 'function' },
  'feedback.confirm': { static: (a) => typeof a.feedback?.confirm === 'function' },
  'overlay.supportsDrawer': { static: (a) => Boolean(a.primitives?.Drawer) },

  // ── 显性欠债：声明了，但目前没有任何验证 ──────────────────────
  'form.labelWidth': {
    browserOnly: {
      reason: '标签宽度只有视觉结果，jsdom 没有布局引擎量不出来',
      script: 'scripts/visual/verify-form-capabilities.py',
    },
  },
  'form.asyncValidator': {
    browserOnly: {
      reason: '异步校验器的结算与错误文案回填依赖真实事件循环',
      script: 'scripts/visual/verify-form-capabilities.py',
    },
  },
  'form.validateOn': {
    browserOnly: {
      reason:
        'jsdom 下 element-plus 的 validate() 即便不经过适配器、直接用 ElForm + required 规则也返回 true，' +
        '属于环境限制而非适配器缺陷',
      script: 'scripts/visual/verify-form-capabilities.py',
    },
  },
  'overlay.supportsTeleport': { marker: 'overlay.supportsTeleport' },
  'pagination.pageSizes': { marker: 'pagination.pageSizes' },
  'pagination.jumper': { marker: 'pagination.jumper' },
  'pagination.mode': {
    browserOnly: {
      reason:
        'jsdom 没有布局：van-list 的触底检测依赖真实 scrollHeight / scrollTop / clientHeight，' +
        '实测派发 scroll 事件也不会触发 load，只能在真实浏览器里滚到底',
      script: 'scripts/visual/verify-form-capabilities.py',
    },
  },

  // features 是细粒度可选能力的开放集合
  'features.table.fixedColumns': { marker: 'features.table.fixedColumns' },
  /* `features.table.summary` 与 `features.form.inline` 已从表中移除：
     两者全仓零实现，三个适配器都已声明为 false，不再需要验证责任。
     将来谁把它们改回 true，「完整性」用例会立刻要求补覆盖 —— 这是设计好的路径。 */
}
