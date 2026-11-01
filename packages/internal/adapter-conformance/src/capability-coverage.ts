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
  'form.labelWidth': { unverified: '标签宽度只有视觉差异，jsdom 量不出来，需要浏览器断言' },
  'form.asyncValidator': { unverified: '异步校验的时序无法在一致性套件里稳定断言' },
  'form.validateOn': { unverified: '校验时机需要逐事件驱动，三条触发路径尚未覆盖' },
  'overlay.supportsTeleport': { unverified: 'teleport 目标是 body，断言依赖挂载细节' },
  'pagination.pageSizes': { unverified: '各家的每页条数选择器类名差异大，尚未声明选择器' },
  'pagination.jumper': { unverified: '同上，跳页输入框尚未声明选择器' },
  'pagination.mode': { unverified: '无限滚动的触底加载尚未进一致性套件' },
  'theme.cssVariables': { unverified: '「是否用 CSS 变量」是实现描述，没有可观测行为' },

  // features 是细粒度可选能力的开放集合
  'features.table.fixedColumns': { unverified: '固定列尚未进一致性套件' },
  'features.table.summary': { unverified: '合计行尚未进一致性套件' },
  'features.form.inline': { unverified: '行内表单尚未进一致性套件' },
}
