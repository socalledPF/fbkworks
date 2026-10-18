export type ResponsiveColumns = number | { xs?: number; sm?: number; md?: number; lg?: number }

const ORDER = ['xs', 'sm', 'md', 'lg'] as const

/**
 * 把响应式列数展开成 CSS 变量，供样式表用 var() 回退链按断点取值。
 *
 * 历史：这个函数原先返回一个自定义 DSL 字符串
 * （`@container (min-width: 640px) 2 | ...`），但**没有任何样式表消费它**，
 * 也没有任何组件调用它 —— 三个组件的对象形式列数因此全部静默失效。
 * 现在改成返回变量表，取值逻辑交给 CSS 的 var() 回退，JS 不参与。
 *
 * 返回值直接用于 :style：
 *   数字形式 columns={3}       → { '--fbk-cols-base': '3' }
 *   对象形式 columns={{md:3}}  → { '--fbk-cols-md': '3' }
 *   未传                       → {}（样式表回退到组件令牌的默认值）
 *
 * 对象形式里**缺省的断点不写变量**，于是它们会沿 var() 链回退到更小的断点，
 * 最终回退到 --fbk-cols-base。这符合「只写差异」的直觉：
 * `{ xs: 1, md: 3 }` 表示「小屏 1 列，中屏起 3 列，其余跟随」。
 */
export function resolveColumns(columns: ResponsiveColumns | undefined): Record<string, string> {
  if (columns === undefined) return {}

  if (typeof columns === 'number') {
    return { '--fbk-cols-base': String(columns) }
  }

  const vars: Record<string, string> = {}
  for (const key of ORDER) {
    const value = columns[key]
    if (value !== undefined) vars[`--fbk-cols-${key}`] = String(value)
  }
  return vars
}
