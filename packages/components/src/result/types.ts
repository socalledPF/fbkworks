/**
 * Result 异常状态页。
 *
 * `403 / 404 / 500 / 无权限 / 空数据` 这类页面每个项目都要写一遍，
 * 而且写法各异。这里固化成一套语义 + 插槽。
 *
 * 不需要适配器：纯展示组件，只用 tokens 与 CSS。这也说明
 * 「不是所有组件都要经过适配层」—— 只有三库行为确实不同的部分才需要。
 */

export type ResultStatus = 'success' | 'warning' | 'error' | 'info' | '403' | '404' | '500'

export interface ResultProps {
  /** 语义状态。数字形式（403/404/500）会渲染成大号状态码 */
  status?: ResultStatus
  /** 主标题。不传时按 status 取默认文案 */
  title?: string
  /** 补充说明 */
  subtitle?: string
  /** 额外内容（错误详情、联系方式等） */
  extra?: string
}

export interface ResultSlots {
  /** 覆盖默认图标 */
  icon?: () => unknown
  /** 标题下方的内容区 */
  default?: () => unknown
  /** 操作区（按钮组） */
  actions?: () => unknown
}

/** 各状态的默认文案。业务方不传 title/subtitle 时使用 */
export const RESULT_DEFAULTS: Record<ResultStatus, { title: string; subtitle?: string }> = {
  success: { title: '操作成功' },
  warning: { title: '请注意' },
  error: { title: '出错了', subtitle: '请稍后重试，或联系管理员' },
  info: { title: '提示' },
  '403': { title: '无访问权限', subtitle: '你当前的角色没有查看该页面的权限' },
  '404': { title: '页面不存在', subtitle: '链接可能已失效，或页面已被移除' },
  '500': { title: '服务器错误', subtitle: '服务暂时不可用，请稍后重试' },
}
